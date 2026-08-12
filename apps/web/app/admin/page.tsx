'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, RefreshCw, Activity, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AdminOverviewMetrics, AdminUserListItem } from '@/lib/admin/types';
import { AdminKpiCards } from '@/components/admin/AdminKpiCards';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    setErrorMessage(null);

    const token = session.access_token;
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      // 1. Busca Métricas de Overview
      const resOverview = await fetch('/api/admin/overview', { headers });
      if (resOverview.status === 403 || resOverview.status === 401) {
        setAccessDenied(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const dataOverview = await resOverview.json();
      if (!resOverview.ok) {
        throw new Error(dataOverview.error || 'Erro ao carregar métricas.');
      }
      setMetrics(dataOverview.metrics);

      // 2. Busca Lista de Usuários
      const resUsers = await fetch('/api/admin/users', { headers });
      const dataUsers = await resUsers.json();
      if (!resUsers.ok) {
        throw new Error(dataUsers.error || 'Erro ao carregar lista de usuários.');
      }
      setUsers(dataUsers.users || []);
    } catch (err: any) {
      console.error('[AdminDashboardPage] Erro ao carregar dados:', err);
      setErrorMessage(err?.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (accessDenied) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acesso Negado à Área Administrativa</h2>
        <p className="text-xs text-gray-400 max-w-md mb-6">
          Seu usuário autenticado não possui privilégios de administrador. Apenas o UUID especificado em <code className="text-purple-300 font-mono bg-purple-950/50 px-1.5 py-0.5 rounded">ADMIN_USER_ID</code> no servidor tem autorização para visualizar este painel.
        </p>
        <Link
          href="/"
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Voltar para o Painel Principal</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Topo com Título e Recarregar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Dashboard de Administração
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Visão consolidada de KPIs, performance de atendimentos, WhatsApp e Web Push
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={refreshing}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 hover:bg-purple-900/50 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Atualizando...' : 'Atualizar Dados'}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Cards de Métricas Principais */}
      <AdminKpiCards metrics={metrics} loading={loading} />

      {/* Tabela de Gestão de Usuários */}
      <AdminUsersTable users={users} loading={loading} onRefresh={fetchData} />
    </div>
  );
}
