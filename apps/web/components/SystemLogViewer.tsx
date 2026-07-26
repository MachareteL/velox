'use client';

import React, { useState } from 'react';
import { Terminal, ShieldAlert, Info, AlertTriangle, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
import type { SystemLog } from '@velox/types';

interface SystemLogViewerProps {
  logs: SystemLog[];
}

export function SystemLogViewer({ logs }: SystemLogViewerProps) {
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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

  const getEventName = (eventType: string) => {
    switch (eventType) {
      case 'QR_GENERATED':
        return 'Novo Código de Conexão';
      case 'SESSION_READY':
        return 'WhatsApp Conectado';
      case 'HTTP_POST_SUCCESS':
        return 'Convite Aceito';
      case 'HTTP_POST_ERROR':
        return 'Convite Não Aceito';
      case 'AUTOMATION_PAUSED':
        return 'Automação Pausada';
      case 'FLEET_CAPACITY_REACHED':
        return 'Capacidade da Frota Atingida';
      case 'RECONNECT':
        return 'Reconexão de Segurança';
      default:
        return eventType;
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-800/60 pb-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Console de Histórico de Atividades & Diagnósticos</h2>
          </div>
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setFilterLevel('ALL')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              filterLevel === 'ALL' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos ({logs.length})
          </button>
          <button
            onClick={() => setFilterLevel('INFO')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              filterLevel === 'INFO' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            Sucesso
          </button>
          <button
            onClick={() => setFilterLevel('WARN')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              filterLevel === 'WARN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            Avisos
          </button>
          <button
            onClick={() => setFilterLevel('ERROR')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              filterLevel === 'ERROR' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            Erros
          </button>
        </div>
      </div>

      <div className="bg-gray-950/90 rounded-xl p-4 text-xs max-h-96 overflow-y-auto border border-gray-900 font-mono divide-y divide-gray-900">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-600 py-6 text-center text-xs">Nenhuma atividade registrada para este nível de filtro.</div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const hasDetails = Boolean(log.details);

            return (
              <div key={log.id} className="py-2.5 transition-colors">
                <div
                  onClick={() => hasDetails && toggleExpand(log.id)}
                  className={`flex items-start gap-3 px-2 py-1 rounded-lg ${
                    hasDetails ? 'cursor-pointer hover:bg-gray-900/80' : ''
                  }`}
                >
                  <span className="text-gray-500 flex-shrink-0 select-none text-[11px]">
                    [{new Date(log.created_at).toLocaleTimeString('pt-BR')}]
                  </span>
                  {getLogIcon(log.level)}
                  <span className="font-semibold text-gray-200 flex-shrink-0 text-[11px]">
                    {getEventName(log.event_type)}:
                  </span>
                  <span className="text-gray-300 flex-1 text-[11px]">{log.message}</span>

                  {hasDetails && (
                    <button className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300 flex-shrink-0">
                      <Code2 className="w-3.5 h-3.5" />
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Painel de Diagnóstico Expandido */}
                {isExpanded && log.details && (
                  <div className="mt-2 ml-8 p-3 rounded-xl bg-gray-900/90 border border-gray-800 text-[11px] text-gray-300 space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5" /> Diagnóstico Técnico do Evento
                    </div>
                    <pre className="p-2 bg-gray-950 rounded-lg border border-gray-800 text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
