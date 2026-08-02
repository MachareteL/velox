import pino, { Logger as PinoLogger } from "pino";

export interface LogContext {
  tenantId?: string;
  workerId?: string;
  sessionId?: string;
  operationId?: string;
  socketId?: string;
  ambiente?: string;
  versao?: string;
  baileysVersion?: string;
  [key: string]: any;
}

export class WorkerLogger {
  constructor(private pinoLogger: PinoLogger, private context: LogContext = {}) {}

  public getContext(): LogContext {
    return { ...this.context };
  }

  public child(newContext: Partial<LogContext>): WorkerLogger {
    const merged = { ...this.context, ...newContext };
    return new WorkerLogger(this.pinoLogger.child(newContext), merged);
  }

  public info(msg: string, obj?: object): void {
    if (obj) {
      this.pinoLogger.info(obj, msg);
    } else {
      this.pinoLogger.info(msg);
    }
  }

  public warn(msg: string, obj?: object): void {
    if (obj) {
      this.pinoLogger.warn(obj, msg);
    } else {
      this.pinoLogger.warn(msg);
    }
  }

  public error(msg: string, errOrObj?: Error | string | object, obj?: object): void {
    if (errOrObj instanceof Error) {
      this.pinoLogger.error(
        {
          err: {
            message: errOrObj.message,
            stack: errOrObj.stack,
            name: errOrObj.name,
          },
          ...obj,
        },
        msg
      );
    } else if (typeof errOrObj === "object" && errOrObj !== null) {
      this.pinoLogger.error({ ...errOrObj, ...obj }, msg);
    } else if (typeof errOrObj === "string") {
      this.pinoLogger.error({ error: errOrObj, ...obj }, msg);
    } else {
      this.pinoLogger.error(obj || {}, msg);
    }
  }

  public debug(msg: string, obj?: object): void {
    if (obj) {
      this.pinoLogger.debug(obj, msg);
    } else {
      this.pinoLogger.debug(msg);
    }
  }

  // ── High-Value Operational Logging Helpers ───────────────────────────

  public worker(event: string, msg: string, details?: object): void {
    this.pinoLogger.info(
      {
        category: "WORKER",
        event,
        ...details,
      },
      msg
    );
  }

  public socket(event: string, msg: string, details?: object): void {
    const level = event === "CONCURRENT_SOCKET_DETECTED" ? "error" : "info";
    this.pinoLogger[level](
      {
        category: "SOCKET",
        event,
        ...details,
      },
      msg
    );
  }

  public watchdog(event: string, msg: string, details?: object): void {
    this.pinoLogger.warn(
      {
        category: "WATCHDOG",
        event,
        ...details,
      },
      msg
    );
  }

  public auth(event: string, durationMs?: number, success: boolean = true, details?: object): void {
    const level = success ? "info" : "error";
    this.pinoLogger[level](
      {
        category: "AUTH",
        event,
        durationMs,
        success,
        ...details,
      },
      `Auth event [${event}]: ${success ? "SUCCESS" : "FAILED"}${durationMs !== undefined ? ` (${durationMs}ms)` : ""}`
    );
  }

  public fsm(
    previousState: string,
    currentState: string,
    reason?: string,
    source?: string,
    details?: object
  ): void {
    this.pinoLogger.info(
      {
        category: "FSM",
        event: "FSM_TRANSITION",
        previousState,
        currentState,
        reason: reason || "N/A",
        source: source || "UNKNOWN",
        ...details,
      },
      `FSM State Transition: ${previousState} -> ${currentState} [Reason: ${reason || "N/A"}, Source: ${source || "UNKNOWN"}]`
    );
  }

  public mutex(
    event: "MUTEX_WAIT" | "MUTEX_ACQUIRED" | "MUTEX_RELEASED",
    msg: string,
    details?: { waitTimeMs?: number; executionTimeMs?: number; [key: string]: any }
  ): void {
    this.pinoLogger.debug(
      {
        category: "MUTEX",
        event,
        ...details,
      },
      msg
    );
  }
}

export class LoggerFactory {
  private static rootLogger: PinoLogger | null = null;

  public static getRootLogger(): PinoLogger {
    if (!this.rootLogger) {
      const isDev = process.env.NODE_ENV !== "production";
      this.rootLogger = pino({
        level: process.env.LOG_LEVEL || "info",
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level: (label) => ({ level: label }),
        },
        transport: isDev
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            }
          : undefined,
      });
    }
    return this.rootLogger;
  }

  public static forTenant(
    tenantId: string,
    sessionId?: string,
    operationId?: string,
    socketId?: string,
    additionalContext?: Partial<LogContext>
  ): WorkerLogger {
    const root = this.getRootLogger();
    const context: LogContext = {
      tenantId,
      sessionId: sessionId || "N/A",
      workerId: process.env.WORKER_ID || "vps-worker-01",
      operationId: operationId || "N/A",
      socketId: socketId || "N/A",
      ambiente: process.env.NODE_ENV || "development",
      versao: "1.0.0",
      baileysVersion: "6.7.18",
      ...additionalContext,
    };
    return new WorkerLogger(root.child(context), context);
  }

  public static forOrchestrator(operationId?: string): WorkerLogger {
    const root = this.getRootLogger();
    const context: LogContext = {
      tenantId: "SYSTEM",
      sessionId: "ORCHESTRATOR",
      workerId: process.env.WORKER_ID || "vps-worker-01",
      operationId: operationId || "SYSTEM_BOOT",
      socketId: "N/A",
      ambiente: process.env.NODE_ENV || "development",
      versao: "1.0.0",
      baileysVersion: "6.7.18",
    };
    return new WorkerLogger(root.child(context), context);
  }
}
