'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Smartphone,
  PhoneCall,
  Bell,
  Eye,
  Send,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { AdminUserListItem } from '@/lib/admin/types';
import { SendPushModal } from './SendPushModal';

interface AdminUsersTableProps {
  users: AdminUserListItem[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function AdminUsersTable({ users, loading, onRefresh }: AdminUsersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUserForPush, setSelectedUserForPush] = useState<AdminUserListItem | null>(null);

  const filteredUsers = users.filter((u) => {
    const matchesQuery =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter ? u.sessionStatus === statusFilter : true;

    return matchesQuery && matchesStatus;
  });

  const getStatusBadge = (status: string, isActive: boolean) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Conectado
          </span>
        );
      case 'AUTHENTICATING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            Autenticando
          </span>
        );
      case 'DISCONNECTED_NEED_QR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Aguardando QR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            Desconectado
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl mb-8">
      {/* Header com Busca e Filtros */}
      <div className="p-5 border-b border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-950">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-400" />
            <span>Gestão de Usuários & Tenants</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 font-mono">
              {filteredUsers.length} de {users.length}
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Visualize o status de conexão WhatsApp e atividade de cada prestador
          </p>
        </div>

        {/* Input de Busca e Dropdown de Filtro */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="relative w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-300 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
            >
              <option value="">Todos os Status</option>
              <option value="CONNECTED">Conectado</option>
              <option value="DISCONNECTED_NEED_QR">Aguardando QR</option>
              <option value="DISCONNECTED">Desconectado</option>
              <option value="AUTHENTICATING">Autenticando</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-300">
          <thead className="bg-gray-950/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Prestador</th>
              <th className="py-3.5 px-4 font-semibold">Status WhatsApp</th>
              <th className="py-3.5 px-4 font-semibold">Automação</th>
              <th className="py-3.5 px-4 font-semibold">Atendimentos</th>
              <th className="py-3.5 px-4 font-semibold">Web Push</th>
              <th className="py-3.5 px-4 font-semibold">Cadastro</th>
              <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4"><div className="h-4 bg-gray-800 rounded w-36" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-800 rounded w-24" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-800 rounded w-20" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-gray-800 rounded w-24" /></td>
                  <td className="py-4 px-4 text-right"><div className="h-4 bg-gray-800 rounded w-16 ml-auto" /></td>
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  Nenhum usuário encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/40 transition-colors group">
                  {/* Nome e Email */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-white group-hover:text-purple-300 transition-colors">
                      {u.name}
                    </div>
                    <div className="text-gray-400 text-[11px] font-mono">{u.email}</div>
                  </td>

                  {/* Status WhatsApp */}
                  <td className="py-3.5 px-4">
                    {getStatusBadge(u.sessionStatus, u.isActiveAutomation)}
                    {u.phoneNumber && (
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">
                        +{u.phoneNumber}
                      </div>
                    )}
                  </td>

                  {/* Estado da Automação */}
                  <td className="py-3.5 px-4">
                    {u.isActiveAutomation ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        LIGADA
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        PAUSADA
                      </span>
                    )}
                  </td>

                  {/* Contagem de Atendimentos */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{u.totalCalls} capturas</div>
                    <div className="text-[10px] text-emerald-400">
                      {u.successfulCalls} aceitos com sucesso
                    </div>
                  </td>

                  {/* Status de Web Push */}
                  <td className="py-3.5 px-4">
                    {u.pushSubscriptionsCount > 0 ? (
                      <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                        <Bell className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{u.pushSubscriptionsCount} dispositivo(s)</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-[11px]">Nenhum push</span>
                    )}
                  </td>

                  {/* Data de Cadastro */}
                  <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                    <div>{formatDate(u.created_at)}</div>
                    {u.lastLogAt && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Últ. atividade: {formatDate(u.lastLogAt)}
                      </div>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedUserForPush(u)}
                        title="Enviar notificação push de teste"
                        className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-all flex items-center gap-1"
                      >
                        <Send className="w-3 h-3 text-purple-400" />
                        <span className="hidden lg:inline">Testar Push</span>
                      </button>

                      <Link
                        href={`/admin/users/${u.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-semibold transition-all flex items-center gap-1 border border-gray-700"
                      >
                        <Eye className="w-3 h-3 text-emerald-400" />
                        <span>Detalhes</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Teste de Push */}
      {selectedUserForPush && (
        <SendPushModal
          isOpen={!!selectedUserForPush}
          onClose={() => setSelectedUserForPush(null)}
          targetUser={{
            id: selectedUserForPush.id,
            name: selectedUserForPush.name,
            email: selectedUserForPush.email,
          }}
          onPushSent={onRefresh}
        />
      )}
    </div>
  );
}
