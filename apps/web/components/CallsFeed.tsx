'use client';

import React from 'react';
import { ExternalLink, CheckCircle2, XCircle, Clock, MapPin, DollarSign, CheckSquare, Truck } from 'lucide-react';
import type { CapturedCall } from '@velox/types';
import { supabase } from '../lib/supabase';
import { completeCapturedCall } from '@velox/database';

interface CallsFeedProps {
  calls: CapturedCall[];
  onRefreshCalls: () => void;
}

export function CallsFeed({ calls, onRefreshCalls }: CallsFeedProps) {
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
      };
    }

    if (call.completed_at) {
      return {
        label: 'Concluído',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        isActive: false,
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
      };
    }

    return {
      label: 'Concluído',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      isActive: false,
    };
  };

  return (
    <div className="glass-panel rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Feed de Chamados Processados
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </h2>
          <p className="text-xs text-gray-400">Acompanhe ao vivo os convites lidos e respondidos pelo seu sistema</p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-gray-800 rounded-full text-gray-300 border border-gray-700">
          {calls.length} chamados
        </span>
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Nenhum chamado recebido ainda.</p>
          <p className="text-xs text-gray-600 mt-1">
            Mantenha seu WhatsApp conectado. Quando uma mensagem com link de convite for recebida, ela aparecerá aqui instantaneamente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-400 bg-gray-950/60 border-b border-gray-800">
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
            <tbody className="divide-y divide-gray-800/50">
              {calls.map((call) => {
                const statusInfo = getCallStatusInfo(call);
                return (
                  <tr key={call.id} className="hover:bg-gray-800/30 transition-colors">
                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${statusInfo.badgeClass}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>

                    {/* Veículo Alocado */}
                    <td className="py-3 px-4 text-xs text-gray-300">
                      {call.vehicle ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                          <Truck className="w-3.5 h-3.5 text-emerald-400" />
                          {call.vehicle.title}
                        </span>
                      ) : (
                        <span className="text-gray-500">Padrão</span>
                      )}
                    </td>

                    {/* Duração em ms */}
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">
                      {call.duration_ms} ms
                    </td>

                    {/* Prévia (minutos) */}
                    <td className="py-3 px-4 font-semibold text-white">
                      <span className="inline-flex items-center gap-1 text-amber-300 text-xs">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {call.previa_minutos || 90} min
                      </span>
                    </td>

                    {/* URL */}
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4 text-xs text-gray-400 font-mono">
                      {new Date(call.created_at).toLocaleTimeString('pt-BR')}
                    </td>

                    {/* Ação (Finalizar Atendimento) */}
                    <td className="py-3 px-4 text-right">
                      {statusInfo.isActive && (
                        <button
                          onClick={() => handleFinishCall(call.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
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
