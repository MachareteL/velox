'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Smartphone,
  PhoneCall,
  Bell,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ShieldCheck,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AdminUserDetail } from '@/lib/admin/types';
import { SendPushModal } from '@/components/admin/SendPushModal';

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const { session } = useAuth();
  const router = useRouter();
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);

  const fetchUserDetail = useCallback(async () => {
    if (!session || !params.id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${params.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar detalhes do usuário.');
      }

      setUserDetail(data.user);
    } catch (err: any) {
      console.error('[AdminUserDetailPage] Erro:', err);
      setError(err?.message || 'Falha ao buscar dados do usuário.');
    } finally {
      setLoading(false);
    }
  }, [session, params.id]);

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <Activity className="w-10 h-10 text-purple-400 animate-spin mb-3" />
        <p className="text-xs font-mono text-gray-400">Carregando diagnósticos do prestador...</p>
      </div>
    );
  }

  if (error || !userDetail) {
    return (
      <div className="py-12 space-y-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-purple-400" />
          <span>Voltar para o Painel Admin</span>
        </Link>
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          ⚠️ {error || 'Usuário não encontrado.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botão de Voltar */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-purple-400" />
          <span>Voltar para o Painel Admin</span>
        </Link>
      </div>

      {/* Header com Perfil e Ação de Push */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-950 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-lg shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>{userDetail.name}</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                TENANT ID: {userDetail.id.slice(0, 8)}...
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{userDetail.email}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Cadastrado em: {formatDate(userDetail.created_at)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsPushModalOpen(true)}
          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>Enviar Push de Teste</span>
        </button>
      </div>

      {/* Grid de Estatísticas Individuais do Usuário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
          <span className="text-xs text-gray-400">Total de Capturas</span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {userDetail.metrics.totalCalls}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
          <span className="text-xs text-gray-400">Aceitos com Sucesso</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            {userDetail.metrics.successfulCalls}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
          <span className="text-xs text-gray-400">Taxa de Sucesso</span>
          <div className="text-2xl font-extrabold text-purple-300 mt-1">
            {userDetail.metrics.successRatePercentage}%
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
          <span className="text-xs text-gray-400">Volume Capturado</span>
          <div className="text-2xl font-extrabold text-teal-300 mt-1">
            {formatCurrency(userDetail.metrics.totalValueEstimate)}
          </div>
        </div>
      </div>

      {/* Seção 1: Status da Sessão do WhatsApp */}
      <div className="p-6 rounded-3xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Status da Conexão WhatsApp</span>
        </h2>

        {userDetail.session ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400">Status Atual:</span>
              <div className="font-bold text-white mt-1 uppercase">
                {userDetail.session.status}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400">Automação:</span>
              <div className="font-bold mt-1">
                {userDetail.session.is_active ? (
                  <span className="text-emerald-400">LIGADA</span>
                ) : (
                  <span className="text-amber-400">PAUSADA</span>
                )}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400">Telefone Conectado:</span>
              <div className="font-bold text-white mt-1 font-mono">
                {userDetail.session.phone_number ? `+${userDetail.session.phone_number}` : '—'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800">
              <span className="text-gray-400">Última Atualização:</span>
              <div className="font-bold text-gray-300 mt-1">
                {formatDate(userDetail.session.updated_at)}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-gray-950 text-gray-500 text-xs">
            Nenhuma sessão de WhatsApp inicializada para este tenant.
          </div>
        )}
      </div>

      {/* Seção 2: Dispositivos de Web Push Cadastrados */}
      <div className="p-6 rounded-3xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <span>Dispositivos com Notificação Push ({userDetail.pushSubscriptions.length})</span>
          </h2>
        </div>

        {userDetail.pushSubscriptions.length === 0 ? (
          <div className="p-4 rounded-xl bg-gray-950 text-gray-500 text-xs">
            Este prestador ainda não ativou notificações Push em nenhum navegador/dispositivo.
          </div>
        ) : (
          <div className="space-y-2">
            {userDetail.pushSubscriptions.map((sub: any) => (
              <div
                key={sub.id}
                className="p-3.5 rounded-xl bg-gray-950 border border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-cyan-300 truncate max-w-md">
                    {sub.user_agent || 'Navegador Padrão'}
                  </div>
                  <div className="text-gray-500 font-mono text-[10px] truncate max-w-lg mt-0.5">
                    {sub.endpoint}
                  </div>
                </div>
                <div className="text-gray-400 text-[11px] shrink-0">
                  Registrado: {formatDate(sub.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção 3: Histórico Recente de Atendimentos */}
      <div className="p-6 rounded-3xl bg-gray-900/70 border border-gray-800 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-teal-400" />
          <span>Últimos Chamados Capturados ({userDetail.recentCalls.length})</span>
        </h2>

        {userDetail.recentCalls.length === 0 ? (
          <div className="p-4 rounded-xl bg-gray-950 text-gray-500 text-xs">
            Nenhum chamado capturado para este prestador ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-950 text-gray-400 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Distância</th>
                  <th className="py-2.5 px-3">Valor Prévia</th>
                  <th className="py-2.5 px-3">Tempo de Resposta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {userDetail.recentCalls.map((call: any) => (
                  <tr key={call.id} className="hover:bg-gray-800/30">
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {formatDate(call.created_at)}
                    </td>
                    <td className="py-2.5 px-3">
                      {call.status === 'SUCCESS' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sucesso
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Falha
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {call.distancia_km ? `${call.distancia_km} km` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {call.previa_valor ? formatCurrency(call.previa_valor) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400">
                      {call.duration_ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Teste de Push */}
      <SendPushModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        targetUser={{
          id: userDetail.id,
          name: userDetail.name,
          email: userDetail.email,
        }}
        onPushSent={fetchUserDetail}
      />
    </div>
  );
}
