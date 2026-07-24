'use client';

import React, { useEffect, useState } from 'react';
import type { CapturedCall, SystemLog, WhatsAppSession, WhatsAppSessionStatus } from '@velox/types';
import { supabase, DEFAULT_SESSION_ID, DEFAULT_TENANT_ID } from '../lib/supabase';
import { Navbar } from '../components/Navbar';
import { MetricsCards } from '../components/MetricsCards';
import { CallsFeed } from '../components/CallsFeed';
import { SystemLogViewer } from '../components/SystemLogViewer';
import { QRModal } from '../components/QRModal';

export default function DashboardPage() {
  const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [calls, setCalls] = useState<CapturedCall[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    // 1. Carrega o estado inicial da sessão do WhatsApp
    const fetchInitialSession = async () => {
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('id', DEFAULT_SESSION_ID)
        .single();

      if (data) {
        setSessionStatus(data.status as WhatsAppSessionStatus);
        setQrCode(data.qr_code);
        if (data.status === 'DISCONNECTED_NEED_QR') {
          setIsQRModalOpen(true);
        }
      }
    };

    // 2. Carrega lista inicial de chamados capturados
    const fetchInitialCalls = async () => {
      const { data } = await supabase
        .from('captured_calls')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setCalls(data as CapturedCall[]);
    };

    // 3. Carrega lista inicial de logs do sistema
    const fetchInitialLogs = async () => {
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setLogs(data as SystemLog[]);
    };

    fetchInitialSession();
    fetchInitialCalls();
    fetchInitialLogs();

    // 4. Inscreve em atualizações em Tempo Real via Supabase Realtime
    const channel = supabase
      .channel('dashboard-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_sessions',
          filter: `id=eq.${DEFAULT_SESSION_ID}`,
        },
        (payload: any) => {
          const updated = payload.new as WhatsAppSession;
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
          filter: `tenant_id=eq.${DEFAULT_TENANT_ID}`,
        },
        (payload: any) => {
          const newCall = payload.new as CapturedCall;
          setCalls((prev) => [newCall, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs',
          filter: `tenant_id=eq.${DEFAULT_TENANT_ID}`,
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
  }, []);

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
