'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import type { CapturedCall, SystemLog, Vehicle, WhatsAppSession, WhatsAppSessionStatus } from '@velox/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { Navbar } from '../components/Navbar';
import { MetricsCards } from '../components/MetricsCards';
import { FleetManager } from '../components/FleetManager';
import { CallsFeed } from '../components/CallsFeed';
import { SystemLogViewer } from '../components/SystemLogViewer';
import { QRModal } from '../components/QRModal';
import { Activity, PauseCircle, Bell, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';
import {
  registerServiceWorker,
  getPushSubscriptionStatus,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from '../lib/push-notifications';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>('DISCONNECTED');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [calls, setCalls] = useState<CapturedCall[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  // Estados de Push Notification e PWA
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean>(false);
  const [pushLoading, setPushLoading] = useState<boolean>(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const checkPushStatus = useCallback(async () => {
    const status = await getPushSubscriptionStatus();
    setIsPushSubscribed(status.isSubscribed);
    setIsIOS(status.isIOS);
    setIsPWAInstalled(status.isPWAInstalled);
  }, []);

  useEffect(() => {
    registerServiceWorker();
    checkPushStatus();
  }, [checkPushStatus]);

  const fetchVehicles = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: true });

    if (data) setVehicles(data as Vehicle[]);
  }, [user]);

  const fetchCalls = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('captured_calls')
      .select('*, vehicle:vehicles(*)')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setCalls(data as CapturedCall[]);
  }, [user]);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('system_logs')
      .select('*')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setLogs(data as SystemLog[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const tenantId = user.id;

    // 1. Carrega a sessão inicial do prestador
    const fetchInitialSession = async () => {
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (data) {
        setSessionStatus(data.status as WhatsAppSessionStatus);
        setIsActive(data.is_active !== false);
        setQrCode(data.qr_code);
        if (data.status === 'DISCONNECTED_NEED_QR') {
          setIsQRModalOpen(true);
        }
      } else {
        const { data: newSession } = await supabase
          .from('whatsapp_sessions')
          .upsert(
            { tenant_id: tenantId, status: 'DISCONNECTED', is_active: true },
            { onConflict: 'tenant_id' }
          )
          .select('*')
          .single();

        if (newSession) {
          setSessionStatus(newSession.status as WhatsAppSessionStatus);
          setIsActive(newSession.is_active !== false);
        }
      }
    };

    fetchInitialSession();
    fetchVehicles();
    fetchCalls();
    fetchLogs();

    // 2. Re-busca o estado da sessão ao focar/retornar à aba do navegador (Auto-Healing)
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchInitialSession();
        fetchCalls();
        checkPushStatus();
      }
    };
    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    // 3. Polling defensivo leve a cada 30s para garantir sincronia caso o Realtime caia
    const pollInterval = setInterval(() => {
      fetchInitialSession();
    }, 30000);

    // 4. Inscreve em atualizações em Tempo Real filtradas pelo tenant_id
    const channel = supabase
      .channel(`dashboard-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_sessions',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const updated = payload.new as WhatsAppSession;
          if (updated) {
            setSessionStatus(updated.status);
            setIsActive(updated.is_active !== false);
            setQrCode(updated.qr_code || null);
            setPairingCode(updated.pairing_code || null);
            setPhoneNumber(updated.phone_number || null);

            if (updated.status === 'DISCONNECTED_NEED_QR' || updated.status === 'AUTHENTICATING') {
              setIsQRModalOpen(true);
            } else if (updated.status === 'CONNECTED') {
              setTimeout(() => {
                setIsQRModalOpen(false);
              }, 2500);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicles',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchVehicles();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'captured_calls',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchCalls();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'captured_calls',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchCalls();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const newLog = payload.new as SystemLog;
          setLogs((prev) => [newLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user, fetchVehicles, fetchCalls, fetchLogs, checkPushStatus]);

  const handleToggleActive = async () => {
    if (!user) return;
    const nextState = !isActive;
    setIsActive(nextState);

    await supabase
      .from('whatsapp_sessions')
      .upsert(
        {
          tenant_id: user.id,
          is_active: nextState,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );
  };

  const handleTogglePush = async () => {
    if (!user || pushLoading) return;
    setPushLoading(true);
    setPushError(null);

    try {
      if (isPushSubscribed) {
        await unsubscribeUserFromPush();
        setIsPushSubscribed(false);
      } else {
        await subscribeUserToPush(user.id);
        setIsPushSubscribed(true);
      }
    } catch (err: any) {
      console.error('[DashboardPage] Erro ao alternar Push:', err);
      setPushError(err?.message || 'Falha ao alterar estado das notificações.');
    } finally {
      setPushLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Activity className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
          <p className="text-xs font-mono text-gray-400">Verificando autenticação do prestador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 pb-12">
      <Navbar
        status={sessionStatus}
        isActive={isActive}
        onToggleActive={handleToggleActive}
        onOpenQR={() => setIsQRModalOpen(true)}
        isPushActive={isPushSubscribed}
        onTogglePush={handleTogglePush}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Banner Instrução iOS Safari PWA */}
        {isIOS && !isPWAInstalled && (
          <div className="mb-6 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3">
              <Smartphone className="w-6 h-6 text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>Ativar Notificações no iPhone / iPad</span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-teal-400/20 text-teal-300 font-mono">iOS 16.4+</span>
                </h4>
                <p className="text-xs text-teal-200/80 mt-1">
                  No iOS, para receber notificações sonoras de aceite com a tela bloqueada:
                  <br />
                  1. Toque no ícone <strong>Compartilhar <Share className="w-3 h-3 inline text-teal-300" /></strong> no Safari.
                  <br />
                  2. Selecione <strong>Adicionar à Tela de Início <PlusSquare className="w-3 h-3 inline text-teal-300" /></strong>.
                  <br />
                  3. Abra o app <strong>VeloXON</strong> na tela inicial para ativar os avisos push.

                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Solicitação de Notificação Push */}
        {!isPushSubscribed && (!isIOS || isPWAInstalled) && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-gray-900 border border-teal-500/30 text-teal-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Receba avisos sonoros nativos quando o robô aceitar chamados!</h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  Ative as Notificações Push para ser informado instantaneamente com o som do seu celular mesmo com o navegador em segundo plano.
                </p>
                {pushError && (
                  <p className="text-xs text-rose-400 mt-1.5 font-medium">⚠️ {pushError}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 shadow-lg shadow-teal-500/20 transition-all hover:scale-105 active:scale-95 shrink-0 disabled:opacity-50"
            >
              {pushLoading ? 'Ativando...' : 'Ativar Notificações Push'}
            </button>
          </div>
        )}

        {!isActive && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-3 shadow-lg">
            <PauseCircle className="w-6 h-6 text-amber-400 flex-shrink-0 animate-pulse" />
            <div>
              <h4 className="text-sm font-bold">Automação Pausada pelo Prestador</h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                O seu sistema não realizará aceites automáticos enquanto estiver pausado. Para voltar a aceitar convites instantaneamente, basta clicar no botão <strong>Aceite Automático: PAUSADO</strong> no topo da tela.
              </p>
            </div>
          </div>
        )}

        <MetricsCards calls={calls} />
        <FleetManager vehicles={vehicles} calls={calls} onRefreshVehicles={fetchVehicles} />
        <CallsFeed calls={calls} onRefreshCalls={fetchCalls} />
        <SystemLogViewer logs={logs} />
      </main>

      <QRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        status={sessionStatus}
        qrCode={qrCode}
        pairingCode={pairingCode}
        phoneNumber={phoneNumber}
      />
    </div>
  );
}

