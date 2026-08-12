'use client';

import React from 'react';
import {
  Users,
  Smartphone,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Bell,
  Clock,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { AdminOverviewMetrics } from '@/lib/admin/types';

interface AdminKpiCardsProps {
  metrics: AdminOverviewMetrics | null;
  loading?: boolean;
}

export function AdminKpiCards({ metrics, loading }: AdminKpiCardsProps) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 animate-pulse h-32 flex flex-col justify-between"
          >
            <div className="h-4 bg-gray-800 rounded w-1/2" />
            <div className="h-8 bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-800 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatMs = (ms: number) => {
    if (!ms) return '0 ms';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Usuários / Tenants */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-gray-900/80 to-gray-950 border border-indigo-500/20 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            Total de Usuários
          </span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {metrics.totalUsers}
          </div>
          <p className="text-xs text-indigo-200/70 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">+{metrics.newUsersLast7Days}</span> nos últimos 7 dias
          </p>
        </div>
      </div>

      {/* 2. Sessões WhatsApp */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-gray-900/80 to-gray-950 border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Sessões WhatsApp
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight flex items-center gap-2">
            {metrics.connectedSessions}
            <span className="text-xs font-normal text-gray-400">/ {metrics.totalUsers} conectados</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-amber-400 font-semibold">{metrics.needQrSessions}</span> aguardando QR Code
          </p>
        </div>
      </div>

      {/* 3. Total de Atendimentos Capturados */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-950/40 via-gray-900/80 to-gray-950 border border-teal-500/20 shadow-xl relative overflow-hidden group hover:border-teal-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
            Chamados Capturados
          </span>
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
            <PhoneCall className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {metrics.totalCalls}
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> {metrics.successfulCalls} aceitos
            </span>
            <span>•</span>
            <span className="text-rose-400 font-semibold flex items-center gap-0.5">
              <XCircle className="w-3 h-3" /> {metrics.failedCalls} falhas
            </span>
          </p>
        </div>
      </div>

      {/* 4. Taxa de Sucesso */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-gray-900/80 to-gray-950 border border-purple-500/20 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
            Taxa de Sucesso
          </span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-purple-300 tracking-tight">
            {metrics.successRatePercentage}%
          </div>
          <p className="text-xs text-purple-200/70 mt-1 flex items-center gap-1">
            <Zap className="w-3 h-3 text-purple-400" /> Tempo médio: {formatMs(metrics.avgDurationMs)}
          </p>
        </div>
      </div>

      {/* 5. Volume Financeiro Capturado */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-gray-900/80 to-gray-950 border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Volume Estimado
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold text-emerald-300 tracking-tight">
            {formatCurrency(metrics.totalValueEstimate)}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Soma dos valores prévia dos chamados
          </p>
        </div>
      </div>

      {/* 6. Dispositivos com Web Push */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-gray-900/80 to-gray-950 border border-cyan-500/20 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
            Dispositivos Web Push
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
            <Bell className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {metrics.totalPushSubscriptions}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Em <span className="text-cyan-300 font-semibold">{metrics.usersWithPushCount}</span> usuário(s) ativos
          </p>
        </div>
      </div>

      {/* 7. Automações Ativas */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-gray-900/80 to-gray-950 border border-blue-500/20 shadow-xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
            Automações Ativas
          </span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-blue-300 tracking-tight">
            {metrics.activeAutomations}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Prestadores com aceite automático LIGADO
          </p>
        </div>
      </div>

      {/* 8. Erros Recentes */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-gray-900/80 to-gray-950 border border-rose-500/20 shadow-xl relative overflow-hidden group hover:border-rose-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
            Erros (7 dias)
          </span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-rose-400 tracking-tight">
            {metrics.recentErrorLogsCount}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Logs do sistema com nível ERROR
          </p>
        </div>
      </div>
    </div>
  );
}
