'use client';

import React from 'react';
import { ExternalLink, CheckCircle2, XCircle, Clock, MapPin, DollarSign } from 'lucide-react';
import type { CapturedCall } from '@velox/types';

interface CallsFeedProps {
  calls: CapturedCall[];
}

export function CallsFeed({ calls }: CallsFeedProps) {
  return (
    <div className="glass-panel rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Feed de Chamados Capturados
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </h2>
          <p className="text-xs text-gray-400">Histórico em tempo real de convites lidos e aceitos via WhatsApp</p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-gray-800 rounded-full text-gray-300 border border-gray-700">
          {calls.length} registros
        </span>
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Nenhum chamado capturado ainda.</p>
          <p className="text-xs text-gray-600 mt-1">
            Certifique-se de que seu WhatsApp esteja conectado. Quando um link do Velox for recebido, ele aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-400 bg-gray-950/60 border-b border-gray-800">
              <tr>
                <th className="py-3 px-4 rounded-l-lg">Status</th>
                <th className="py-3 px-4">Velocidade</th>
                <th className="py-3 px-4">Distância</th>
                <th className="py-3 px-4">Prévia Calculada</th>
                <th className="py-3 px-4">URL do Convite</th>
                <th className="py-3 px-4 rounded-r-lg text-right">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-800/30 transition-colors">
                  {/* Status */}
                  <td className="py-3 px-4">
                    {call.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aceito
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" /> Erro
                      </span>
                    )}
                  </td>

                  {/* Duração em ms */}
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-400">
                    {call.duration_ms} ms
                  </td>

                  {/* Distância */}
                  <td className="py-3 px-4 text-gray-300">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-gray-500" />
                      {call.distancia_km ? `${call.distancia_km} km` : 'N/A'}
                    </span>
                  </td>

                  {/* Prévia */}
                  <td className="py-3 px-4 font-semibold text-white">
                    {call.previa_valor ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        R$ {call.previa_valor},00
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>

                  {/* URL */}
                  <td className="py-3 px-4">
                    <a
                      href={call.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-[240px]"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {call.url}
                    </a>
                  </td>

                  {/* Data/Hora */}
                  <td className="py-3 px-4 text-right text-xs text-gray-400 font-mono">
                    {new Date(call.created_at).toLocaleTimeString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
