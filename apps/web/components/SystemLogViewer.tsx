'use client';

import React from 'react';
import { Terminal, ShieldAlert, Info, AlertTriangle } from 'lucide-react';
import type { SystemLog } from '@velox/types';

interface SystemLogViewerProps {
  logs: SystemLog[];
}

export function SystemLogViewer({ logs }: SystemLogViewerProps) {
  const getLogIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />;
      case 'WARN':
        return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Console de Logs do Sistema</h2>
        </div>
        <span className="text-xs text-gray-500 font-mono">Supabase Realtime Stream</span>
      </div>

      <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs max-h-72 overflow-y-auto border border-gray-800 divide-y divide-gray-900">
        {logs.length === 0 ? (
          <div className="text-gray-600 py-6 text-center">Nenhum evento registrado no console ainda.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="py-2 flex items-start gap-3 hover:bg-gray-900/50 px-2 rounded">
              <span className="text-gray-500 flex-shrink-0 select-none">
                [{new Date(log.created_at).toLocaleTimeString('pt-BR')}]
              </span>
              {getLogIcon(log.level)}
              <span className="font-semibold text-gray-300 flex-shrink-0">{log.event_type}:</span>
              <span className="text-gray-400 truncate">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
