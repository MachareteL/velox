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
import { Activity, PauseCircle } from 'lucide-react';

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

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

            if (updated.status === 'DISCONNECTED_NEED_QR') {
              setIsQRModalOpen(true);
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
      supabase.removeChannel(channel);
    };
  }, [user, fetchVehicles, fetchCalls, fetchLogs]);

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
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
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
