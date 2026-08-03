import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Mutex } from "async-mutex";
import { createSupabaseClient } from "@velox/database";
import { WhatsAppWorker } from "./whatsapp";
import { getBaileysAuthDataPath, purgeBaileysSessionDir } from "./baileys-provider";
import { LoggerFactory } from "./logger";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const rootLogger = LoggerFactory.forOrchestrator();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  rootLogger.error("[Worker] ERRO FATAL: SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias no .env!");
  process.exit(1);
}

async function main() {
  rootLogger.info("=== VELOX MULTI-TENANT WORKER ORCHESTRATOR INICIADO ===");

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const activeWorkers = new Map<string, WhatsAppWorker>();
  const tenantMutexes = new Map<string, Mutex>();

  const getTenantMutex = (tenantId: string): Mutex => {
    let mutex = tenantMutexes.get(tenantId);
    if (!mutex) {
      mutex = new Mutex();
      tenantMutexes.set(tenantId, mutex);
    }
    return mutex;
  };

  const startWorkerForTenant = async (
    tenantId: string,
    sessionId: string,
    isActive: boolean,
    phoneNumber?: string | null,
    operationId?: string
  ) => {
    const opId = operationId || crypto.randomUUID();
    const mutex = getTenantMutex(tenantId);
    const tWaitStart = Date.now();

    if (mutex.isLocked()) {
      rootLogger.mutex("MUTEX_WAIT", `Aguardando liberação do mutex para tenant ${tenantId}...`, {
        tenantId,
        operationId: opId,
      });
    }

    return mutex.runExclusive(async () => {
      const waitTimeMs = Date.now() - tWaitStart;
      const tExecStart = Date.now();

      rootLogger.mutex("MUTEX_ACQUIRED", `Mutex obtido para tenant ${tenantId} em ${waitTimeMs}ms`, {
        tenantId,
        operationId: opId,
        waitTimeMs,
      });

      let worker: WhatsAppWorker | undefined = activeWorkers.get(tenantId);

      try {
        if (worker && worker.isRunning()) {
          rootLogger.worker(
            "WORKER_ALREADY_RUNNING",
            `Worker já está ativo para tenant ${tenantId} (Estado: ${worker.getWorkerState()}). Reutilizando instância...`,
            { tenantId, operationId: opId, state: worker.getWorkerState() }
          );
          rootLogger.worker(
            "WORKER_REUSED",
            `Reutilizando instância operacional existente para tenant ${tenantId}`,
            { tenantId, operationId: opId }
          );
          worker.setIsActive(isActive);
          if (phoneNumber && phoneNumber !== worker.getPhoneNumber()) {
            await worker.requestPairingCodeOnDemand(phoneNumber, opId);
          }
          return;
        }

        if (worker && !worker.isRunning()) {
          rootLogger.info(
            `[Orchestrator] Removendo e encerrando instância inativa anterior do tenant ${tenantId}...`,
            { operationId: opId }
          );
          await worker.stop(opId, "CLEANUP_INACTIVE");
          activeWorkers.delete(tenantId);
        }

        const tenantLogger = LoggerFactory.forTenant(tenantId, sessionId, opId);
        rootLogger.worker(
          "WORKER_CREATED",
          `Criando nova instância de WhatsAppWorker para tenant ${tenantId} [Automação: ${
            isActive ? "LIGADA" : "PAUSADA"
          }]${phoneNumber ? ` [Telefone: ${phoneNumber}]` : ""}...`,
          { tenantId, operationId: opId }
        );

        worker = new WhatsAppWorker(
          tenantId,
          sessionId,
          supabase,
          undefined,
          phoneNumber,
          tenantLogger
        );
        worker.setIsActive(isActive);
        activeWorkers.set(tenantId, worker);
        await worker.start(opId, "ORCHESTRATOR_START");
      } catch (err: any) {
        rootLogger.error(`[Orchestrator] Erro ao iniciar worker para tenant ${tenantId}:`, err);
        if (worker) {
          try {
            await worker.stop(opId, "START_ERROR_RECOVERY");
          } catch (_) {}
          activeWorkers.delete(tenantId);
        }
        if (isActive) {
          rootLogger.info(
            `[Orchestrator] Agendando tentativa de recuperação para tenant ${tenantId} em 30s...`,
            { operationId: opId }
          );
          setTimeout(() => {
            startWorkerForTenant(tenantId, sessionId, isActive, phoneNumber, crypto.randomUUID());
          }, 30000);
        }
      } finally {
        const executionTimeMs = Date.now() - tExecStart;
        rootLogger.mutex("MUTEX_RELEASED", `Mutex liberado para tenant ${tenantId} após ${executionTimeMs}ms`, {
          tenantId,
          operationId: opId,
          executionTimeMs,
        });
      }
    });
  };

  const stopWorkerForTenant = async (tenantId: string, operationId?: string) => {
    const opId = operationId || crypto.randomUUID();
    const mutex = getTenantMutex(tenantId);
    const tWaitStart = Date.now();

    if (mutex.isLocked()) {
      rootLogger.mutex("MUTEX_WAIT", `Aguardando liberação do mutex para encerrar tenant ${tenantId}...`, {
        tenantId,
        operationId: opId,
      });
    }

    return mutex.runExclusive(async () => {
      const waitTimeMs = Date.now() - tWaitStart;
      const tExecStart = Date.now();

      rootLogger.mutex("MUTEX_ACQUIRED", `Mutex obtido para encerrar tenant ${tenantId}`, {
        tenantId,
        operationId: opId,
        waitTimeMs,
      });

      try {
        const worker = activeWorkers.get(tenantId);
        if (worker) {
          rootLogger.info(`[Orchestrator] Encerrando worker do tenant ${tenantId}...`, { operationId: opId });
          await worker.stop(opId, "ORCHESTRATOR_STOP");
          activeWorkers.delete(tenantId);
        }
      } catch (err: any) {
        rootLogger.error(`[Orchestrator] Erro ao encerrar worker para tenant ${tenantId}:`, err);
      } finally {
        const executionTimeMs = Date.now() - tExecStart;
        rootLogger.mutex("MUTEX_RELEASED", `Mutex liberado após encerramento do tenant ${tenantId}`, {
          tenantId,
          operationId: opId,
          executionTimeMs,
        });
      }
    });
  };

  // 1. Carrega todas as sessões cadastradas no boot (mesmo pausadas, para manter o socket conectado)
  const bootOpId = crypto.randomUUID();
  const { data: allSessions, error: bootErr } = await supabase
    .from("whatsapp_sessions")
    .select("*");

  if (bootErr) {
    rootLogger.error("[Orchestrator] Erro ao carregar sessões no boot:", bootErr);
  }

  if (allSessions && allSessions.length > 0) {
    rootLogger.info(`[Orchestrator] 🚀 Verificando ${allSessions.length} sessões cadastradas no boot...`, {
      operationId: bootOpId,
    });
    const authDataPath = getBaileysAuthDataPath();

    for (const session of allSessions) {
      const sessionDir = path.join(authDataPath, `session-tenant_${session.tenant_id}`);
      const hasSessionDir = fs.existsSync(sessionDir);

      if (session.status === "CONNECTED" || hasSessionDir) {
        const sessionOpId = crypto.randomUUID();
        rootLogger.info(
          `[Orchestrator] Inicializando robô Baileys para tenant ${session.tenant_id} (Status DB: ${session.status}, Automação: ${
            session.is_active !== false ? "LIGADA" : "PAUSADA"
          }, Pasta em Disco: ${hasSessionDir})...`,
          { operationId: sessionOpId }
        );
        startWorkerForTenant(
          session.tenant_id,
          session.id,
          session.is_active !== false,
          session.phone_number,
          sessionOpId
        ).catch((err) => {
          rootLogger.error(`[Orchestrator] Erro no boot para tenant ${session.tenant_id}:`, err);
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } else {
    rootLogger.info("[Orchestrator] Nenhum WhatsApp encontrado no banco. Aguardando solicitações...");
  }

  // 2. Escuta global de alterações na tabela whatsapp_sessions para todos os tenants
  let realtimeChannel: any = null;

  const createRealtimeSubscription = () => {
    if (realtimeChannel) {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch (_) {}
    }

    realtimeChannel = supabase
      .channel(`multi-tenant-sessions-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_sessions",
        },
        async (payload: any) => {
          const eventOpId = crypto.randomUUID();

          const session = payload.new || payload.old;
          const tenantId = session?.tenant_id;

          rootLogger.worker(
            "REALTIME_EVENT_RECEIVED",
            `Evento Realtime recebido da tabela whatsapp_sessions [event: ${payload.eventType}, tenant: ${tenantId || 'desconhecido'}]`,
            { eventType: payload.eventType, tenantId, operationId: eventOpId }
          );

          if (payload.eventType === "DELETE") {
            const oldSession = payload.old;
            if (oldSession && oldSession.tenant_id) {
              rootLogger.worker(
                "REALTIME_EVENT_PROCESSED",
                `Sessão deletada do banco [tenant: ${oldSession.tenant_id}]. Encerrando worker...`,
                { operationId: eventOpId, action: "STOP_WORKER" }
              );
              await stopWorkerForTenant(oldSession.tenant_id, eventOpId);
            }
            return;
          }

          if (!session || !session.tenant_id) return;

          const existingWorker = activeWorkers.get(session.tenant_id);

          // 1. CHECAGEM DE DESATIVAÇÃO (PAUSA): Executada sob o Mutex exclusivo do Tenant
          if (session.is_active === false) {
            const mutex = getTenantMutex(session.tenant_id);
            await mutex.runExclusive(async () => {
              const currentWorker = activeWorkers.get(session.tenant_id);
              rootLogger.worker(
                "REALTIME_EVENT_PROCESSED",
                `Automação desativada pelo prestador [tenant: ${session.tenant_id}]. Mantendo socket em modo PAUSADO...`,
                { operationId: eventOpId, tenantId: session.tenant_id, reason: "AUTOMATION_PAUSED" }
              );
              if (currentWorker) {
                currentWorker.setIsActive(false);
              } else {
                const authDataPath = getBaileysAuthDataPath();
                const sessionDir = path.join(authDataPath, `session-tenant_${session.tenant_id}`);
                const hasSessionDir = fs.existsSync(sessionDir);
                if (session.status === "CONNECTED" || hasSessionDir) {
                  await startWorkerForTenant(
                    session.tenant_id,
                    session.id,
                    false,
                    session.phone_number,
                    eventOpId
                  );
                }
              }
            });
            return;
          }

          // 2. PREVENÇÃO DE LOOP DE FEEDBACK DO REALTIME:
          // Se o evento é um reflexo de uma alteração do próprio Worker e não houve alteração no estado is_active, ignora!
          if (existingWorker) {
            const currentState = existingWorker.getWorkerState();
            const isMatch =
              (session.status === "CONNECTED" && currentState === "CONNECTED") ||
              (session.status === "AUTHENTICATING" &&
                (currentState === "STARTING" || currentState === "CONNECTING" || currentState === "RECONNECTING")) ||
              (session.status === "DISCONNECTED_NEED_QR" && currentState === "NEED_QR");

            const isActiveChanged = payload.old && payload.old.is_active !== session.is_active;

            if (isMatch && !isActiveChanged) {
              rootLogger.worker(
                "REALTIME_EVENT_IGNORED",
                `Evento do Realtime ignorado (Feedback Loop prevenido) [tenant: ${session.tenant_id}] (Status DB: ${session.status}, Estado Worker: ${currentState})`,
                { operationId: eventOpId, tenantId: session.tenant_id, status: session.status, currentState }
              );
              return;
            }
          }

          if (
            session.status === "DISCONNECTED_NEED_QR" ||
            session.status === "CONNECTED" ||
            session.status === "AUTHENTICATING"
          ) {
            const isFreshResetRequested =
              payload.old &&
              payload.old.status !== "DISCONNECTED_NEED_QR" &&
              session.status === "DISCONNECTED_NEED_QR" &&
              session.qr_code === null &&
              session.pairing_code === null &&
              !session.phone_number;

            if (isFreshResetRequested) {
              if (existingWorker) {
                if (!existingWorker.isRunning() || !existingWorker.getMetrics().isConnected) {
                  rootLogger.worker(
                    "REALTIME_EVENT_PROCESSED",
                    `Redefinição de sessão solicitada para tenant ${session.tenant_id}. Reiniciando worker do zero...`,
                    { operationId: eventOpId, action: "FRESH_RESET" }
                  );
                  await existingWorker.restartForFreshAuth(session.phone_number, eventOpId);
                  return;
                } else {
                  rootLogger.worker(
                    "REALTIME_EVENT_IGNORED",
                    `Worker do tenant ${session.tenant_id} já está CONECTADO. Ignorando evento tardio de redefinição.`,
                    { operationId: eventOpId, tenantId: session.tenant_id }
                  );
                }
              } else {
                purgeBaileysSessionDir(session.tenant_id);
              }
            }

            rootLogger.worker(
              "REALTIME_EVENT_PROCESSED",
              `Evento de sessão processado [tenant: ${session.tenant_id}]: status = ${session.status}, is_active = ${session.is_active}`,
              { operationId: eventOpId, tenantId: session.tenant_id, status: session.status }
            );

            await startWorkerForTenant(
              session.tenant_id,
              session.id,
              true,
              session.phone_number,
              eventOpId
            );
          } else if (session.status === "DISCONNECTED") {
            const authDataPath = getBaileysAuthDataPath();
            const sessionDir = path.join(authDataPath, `session-tenant_${session.tenant_id}`);
            const hasSessionDir = fs.existsSync(sessionDir);

            if (!hasSessionDir) {
              rootLogger.info(
                `[Orchestrator] Sessão desconectada e sem pasta em disco para tenant ${session.tenant_id}. Encerrando worker...`,
                { operationId: eventOpId }
              );
              await stopWorkerForTenant(session.tenant_id, eventOpId);
            } else {
              rootLogger.info(
                `[Orchestrator] Status DISCONNECTED recebido para tenant ${session.tenant_id}, mas mantendo worker rodando por possuir pasta em disco.`,
                { operationId: eventOpId }
              );
              if (!existingWorker || !existingWorker.isRunning()) {
                rootLogger.info(
                  `[Orchestrator] Iniciando worker para tenant ${session.tenant_id} a partir das credenciais salvas em disco...`,
                  { operationId: eventOpId }
                );
                await startWorkerForTenant(
                  session.tenant_id,
                  session.id,
                  true,
                  session.phone_number,
                  eventOpId
                );
              }
            }
          }
        }
      )
      .subscribe((status: string) => {
        rootLogger.info(`[Orchestrator] Status do Canal Realtime Supabase: ${status}`);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          rootLogger.error(
            `[Orchestrator] ⚠️ Canal Realtime do Supabase em estado ${status}! Recriando canal em 10s...`
          );
          setTimeout(() => {
            rootLogger.info("[Orchestrator] 🔄 Recriando assinatura do canal Realtime...");
            createRealtimeSubscription();
          }, 10000);
        }
      });
  };

  createRealtimeSubscription();

  // Keep-alive: verifica periodicamente se o canal Realtime continua ativo
  setInterval(() => {
    const channelState = (realtimeChannel as any)?.state;
    if (channelState && channelState !== "joined" && channelState !== "joining") {
      rootLogger.warn(
        `[Orchestrator] ⚠️ Keep-alive detectou canal Realtime em estado "${channelState}". Recriando assinatura...`
      );
      createRealtimeSubscription();
    }
  }, 5 * 60 * 1000);

  // Tratamento gracioso de desligamento do processo (SIGINT/SIGTERM)
  const shutdownGracefully = async (signal: string) => {
    const shutdownOpId = crypto.randomUUID();
    rootLogger.info(
      `[Orchestrator] Recebido sinal de encerramento ${signal}. Encerrando todos os workers...`,
      { operationId: shutdownOpId }
    );
    for (const [tId, worker] of activeWorkers.entries()) {
      try {
        rootLogger.info(`[Orchestrator] Encerrando worker do tenant ${tId}...`, { operationId: shutdownOpId });
        await worker.stop(shutdownOpId, "PROCESS_SHUTDOWN");
      } catch (err: any) {
        rootLogger.warn(`[Orchestrator] Erro ao encerrar worker do tenant ${tId}:`, err);
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdownGracefully("SIGINT"));
  process.on("SIGTERM", () => shutdownGracefully("SIGTERM"));

  process.on("uncaughtException", (err) => {
    rootLogger.error("[Orchestrator] Exceção não tratada capturada:", err);
  });

  process.on("unhandledRejection", (reason: any) => {
    rootLogger.error("[Orchestrator] Rejeição não tratada capturada:", reason);
  });
}

main().catch((err) => {
  rootLogger.error("[Orchestrator] Erro fatal no orquestrador:", err);
});
