'use client';

import React, { useState, useMemo } from 'react';
import { ExternalLink, CheckCircle2, XCircle, Clock, MapPin, Search, Filter, CheckSquare, Truck } from 'lucide-react';
import type { CapturedCall } from '@velox/types';
import { supabase } from '../lib/supabase';
import { completeCapturedCall } from '@velox/database';

interface CallsFeedProps {
  calls: CapturedCall[];
  onRefreshCalls: () => void;
}

type FilterTab = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export function CallsFeed({ calls, onRefreshCalls }: CallsFeedProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const handleFinishCall = async (callId: string) => {
    try {
      await completeCapturedCall(supabase, callId);
      onRefreshCalls();
    } catch (err) {
      console.error('Erro ao finalizar atendimento:', err);
    }
  };

  const getCallStatusInfo = (call: CapturedCall) => {
    if (call.status === 'FAILED') {
      return {
        label: 'Indisponível',
        badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: <XCircle className="w-3.5 h-3.5" />,
        isActive: false,
        key: 'FAILED',
      };
    }

    if (call.completed_at) {
      return {
        label: 'Concluído',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        isActive: false,
        key: 'COMPLETED',
      };
    }

    const createdAtMs = new Date(call.created_at).getTime();
    const durationMin = call.previa_minutos || 90;
    const isStillActive = Date.now() < createdAtMs + durationMin * 60 * 1000;

    if (isStillActive) {
      return {
        label: 'Em Atendimento',
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: <Clock className="w-3.5 h-3.5 animate-pulse" />,
        isActive: true,
        key: 'ACTIVE',
      };
    }

    return {
      label: 'Concluído',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      isActive: false,
      key: 'COMPLETED',
    };
  };

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      const statusInfo = getCallStatusInfo(call);

      // Filtro por Aba
      if (activeTab === 'ACTIVE' && !statusInfo.isActive) return false;
      if (activeTab === 'COMPLETED' && (statusInfo.key !== 'COMPLETED' || statusInfo.isActive)) return false;
      if (activeTab === 'FAILED' && statusInfo.key !== 'FAILED') return false;

      // Filtro por Busca
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesUrl = call.url.toLowerCase().includes(query);
        const matchesVehicle = call.vehicle?.title.toLowerCase().includes(query);
        const matchesStatus = statusInfo.label.toLowerCase().includes(query);
        return matchesUrl || matchesVehicle || matchesStatus;
      }

      return true;
    });
  }, [calls, activeTab, searchTerm]);

  return (
    <div className="glass-panel rounded-2xl p-6 mb-8 border border-gray-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Feed de Chamados Processados
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Acompanhe ao vivo os convites lidos e respondidos pelo seu sistema</p>
        </div>

        {/* Busca e Abas de Filtro */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Campo de Pesquisa */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por veículo ou link..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-950/80 border border-gray-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors w-full sm:w-48 placeholder:text-gray-600"
            />
          </div>

          {/* Abas */}
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === 'ALL' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos ({calls.length})
            </button>
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === 'ACTIVE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Concluídos
            </button>
            <button
              onClick={() => setActiveTab('FAILED')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === 'FAILED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Indisponíveis
            </button>
          </div>
        </div>
      </div>

      {filteredCalls.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-950/30">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Nenhum chamado encontrado para este filtro.</p>
          <p className="text-xs text-gray-600 mt-1">
            Quando novas mensagens de convite forem recebidas no WhatsApp, elas aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-950/80 border-b border-gray-800/80">
              <tr>
                <th className="py-3 px-4 rounded-l-lg">Status</th>
                <th className="py-3 px-4">Veículo Alocado</th>
                <th className="py-3 px-4">Tempo de Aceite</th>
                <th className="py-3 px-4">Prévia (Chegada)</th>
                <th className="py-3 px-4">Link do Convite</th>
                <th className="py-3 px-4">Horário</th>
                <th className="py-3 px-4 rounded-r-lg text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {filteredCalls.map((call) => {
                const statusInfo = getCallStatusInfo(call);
                return (
                  <tr key={call.id} className="hover:bg-gray-800/20 transition-colors">
                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${statusInfo.badgeClass}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>

                    {/* Veículo Alocado */}
                    <td className="py-3.5 px-4 text-xs text-gray-300">
                      {call.vehicle ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-800/30">
                          <Truck className="w-3.5 h-3.5 text-emerald-400" />
                          {call.vehicle.title}
                        </span>
                      ) : (
                        <span className="text-gray-500 font-mono text-[11px]">Padrão</span>
                      )}
                    </td>

                    {/* Duração em ms */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400 text-xs">
                      {call.duration_ms} ms
                    </td>

                    {/* Prévia (minutos) */}
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-mono">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {call.previa_minutos || 90} min
                      </span>
                    </td>

                    {/* URL */}
                    <td className="py-3.5 px-4">
                      <a
                        href={call.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-[200px]"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        Visualizar Convite
                      </a>
                    </td>

                    {/* Data/Hora */}
                    <td className="py-3.5 px-4 text-xs text-gray-400 font-mono">
                      {new Date(call.created_at).toLocaleTimeString('pt-BR')}
                    </td>

                    {/* Ação (Finalizar Atendimento) */}
                    <td className="py-3.5 px-4 text-right">
                      {statusInfo.isActive && (
                        <button
                          onClick={() => handleFinishCall(call.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          Finalizar Atendimento
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
