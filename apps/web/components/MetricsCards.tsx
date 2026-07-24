'use client';

import React from 'react';
import { Zap, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { CapturedCall } from '@velox/types';

interface MetricsCardsProps {
  calls: CapturedCall[];
}

export function MetricsCards({ calls }: MetricsCardsProps) {
  const totalCalls = calls.length;
  const successfulCalls = calls.filter((c) => c.status === 'SUCCESS').length;
  const failedCalls = calls.filter((c) => c.status === 'FAILED').length;

  const avgDurationMs = totalCalls > 0
    ? Math.round(calls.reduce((acc, c) => acc + (c.duration_ms || 0), 0) / totalCalls)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Chamados */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Lidos</span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Zap className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-white">{totalCalls}</div>
          <p className="text-xs text-gray-400 mt-1">Convites identificados no WhatsApp</p>
        </div>
      </div>

      {/* Aceites com Sucesso */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Convites Aceitos</span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-emerald-400">{successfulCalls}</div>
          <p className="text-xs text-gray-400 mt-1">
            {totalCalls > 0 ? `${Math.round((successfulCalls / totalCalls) * 100)}% de taxa de aproveitamento` : 'Sem chamados registrados'}
          </p>
        </div>
      </div>

      {/* Não Aceitos */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Não Aceitos</span>
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-rose-400">{failedCalls}</div>
          <p className="text-xs text-gray-400 mt-1">Já aceitos por outros ou indisponíveis</p>
        </div>
      </div>

      {/* Tempo de Resposta */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Velocidade de Aceite</span>
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-amber-400">
            {avgDurationMs} <span className="text-lg font-normal text-gray-400">ms</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Tempo médio de resposta automática</p>
        </div>
      </div>
    </div>
  );
}
