'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CapturedCall, SystemLog, WhatsAppSession, WhatsAppSessionStatus } from '@velox/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { Navbar } from '../components/Navbar';
import { MetricsCards } from '../components/MetricsCards';
import { CallsFeed } from '../components/CallsFeed';
import { SystemLogViewer } from '../components/SystemLogViewer';
import { QRModal } from '../components/QRModal';
import { Activity } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [calls, setCalls] = useState<CapturedCall[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const tenantId = user.id;

    console.log(`[Dashboard] Carregando dados para o prestador [tenant_id: ${tenantId}]`);

    // 1. Carrega o estado inicial da sessão do WhatsApp
    const fetchInitialSession = async () => {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('[Dashboard] Erro ao buscar whatsapp_sessions:', error);
      }

      if (data) {
        console.log('[Dashboard] Sessão inicial carregada:', data);
        setSessionStatus(data.status as WhatsAppSessionStatus);
        setQrCode(data.qr_code);
        if (data.status === 'DISCONNECTED_NEED_QR') {
          setIsQRModalOpen(true);
        }
      } else {
        console.log('[Dashboard] Nenhuma sessão encontrada. Criando sessão padrão...');
        const { data: newSession, error: createErr } = await supabase
          .from('whatsapp_sessions')
          .upsert(
            { tenant_id: tenantId, status: 'DISCONNECTED' },
            { onConflict: 'tenant_id' }
          )
          .select('*')
          .single();

        if (createErr) {
          console.error('[Dashboard] Erro ao criar sessão inicial:', createErr);
        } else if (newSession) {
          setSessionStatus(newSession.status as WhatsAppSessionStatus);
        }
      }
    };

    // 2. Carrega lista de chamados capturados
    const fetchInitialCalls = async () => {
      const { data } = await supabase
        .from('captured_calls')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setCalls(data as CapturedCall[]);
    };

    // 3. Carrega lista de logs do sistema
    const fetchInitialLogs = async () => {
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setLogs(data as SystemLog[]);
    };

    fetchInitialSession();
    fetchInitialCalls();
    fetchInitialLogs();

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
          console.log('[Dashboard Realtime] Recebida atualização da sessão:', updated);
          if (updated) {
            setSessionStatus(updated.status);
            setQrCode(updated.qr_code || null);

            if (updated.status === 'DISCONNECTED_NEED_QR') {
              setIsQRModalOpen(true);
            }
          }
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
        (payload: any) => {
          const newCall = payload.new as CapturedCall;
          console.log('[Dashboard Realtime] Novo chamado capturado:', newCall);
          setCalls((prev) => [newCall, ...prev]);
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
          console.log('[Dashboard Realtime] Novo log do sistema:', newLog);
          setLogs((prev) => [newLog, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log(`[Dashboard Realtime] Canal inscrito com status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
      <Navbar status={sessionStatus} onOpenQR={() => setIsQRModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <MetricsCards calls={calls} />
        <CallsFeed calls={calls} />
        <SystemLogViewer logs={logs} />
      </main>

      <QRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        status={sessionStatus}
        qrCode={qrCode}
      />
    </div>
  );
}
