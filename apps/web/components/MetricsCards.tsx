'use client';

import React from 'react';
import { Zap, CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import type { CapturedCall } from '@velox/types';

interface MetricsCardsProps {
  calls: CapturedCall[];
}

export function MetricsCards({ calls }: MetricsCardsProps) {
  const totalCalls = calls.length;
  const successfulCalls = calls.filter((c) => c.status === 'SUCCESS').length;
  const failedCalls = calls.filter((c) => c.status === 'FAILED').length;

  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  const avgDurationMs = totalCalls > 0
    ? Math.round(calls.reduce((acc, c) => acc + (c.duration_ms || 0), 0) / totalCalls)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total Lidos */}
      <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Lidos</span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-extrabold text-white tracking-tight">{totalCalls}</div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            Convites identificados no WhatsApp
          </p>
        </div>
      </div>

      {/* Convites Aceitos */}
      <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Convites Aceitos</span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">{successfulCalls}</div>
          
          {/* Progress Bar para taxa de sucesso */}
          <div className="mt-2 w-full bg-gray-950 rounded-full h-1.5 overflow-hidden border border-gray-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5 font-medium">
            {totalCalls > 0 ? `${successRate}% de taxa de aproveitamento` : 'Sem registros'}
          </p>
        </div>
      </div>

      {/* Não Aceitos */}
      <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Não Aceitos</span>
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 group-hover:scale-110 transition-transform">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-extrabold text-rose-400 tracking-tight">{failedCalls}</div>
          <p className="text-xs text-gray-400 mt-1">Já aceitos por outros ou indisponíveis</p>
        </div>
      </div>

      {/* Velocidade de Aceite */}
      <div className="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Velocidade de Aceite</span>
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
            {avgDurationMs} <span className="text-sm font-normal text-gray-400">ms</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Tempo médio de resposta automática</p>
        </div>
      </div>
    </div>
  );
}
