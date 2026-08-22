'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall,
  FileText,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export function AdminRecordsViewer() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'CALLS' | 'LOGS'>('CALLS');

  // Chamados
  const [calls, setCalls] = useState<any[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callSearch, setCallSearch] = useState('');
  const [callStatusFilter, setCallStatusFilter] = useState('');
  const [callToDelete, setCallToDelete] = useState<any | null>(null);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState('');
  const [logToDelete, setLogToDelete] = useState<any | null>(null);
  const [isClearAllLogsModalOpen, setIsClearAllLogsModalOpen] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const fetchCalls = useCallback(async () => {
    if (!session) return;
    setCallsLoading(true);
    try {
      const res = await fetch('/api/admin/calls?limit=100', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setCalls(data.calls || []);
    } catch (err) {
      console.error('[AdminRecordsViewer] Erro ao carregar chamados:', err);
    } finally {
      setCallsLoading(false);
    }
  }, [session]);

  const fetchLogs = useCallback(async () => {
    if (!session) return;
    setLogsLoading(true);
    try {
      const res = await fetch('/api/admin/logs?limit=100', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch (err) {
      console.error('[AdminRecordsViewer] Erro ao carregar logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === 'CALLS') {
      fetchCalls();
    } else {
      fetchLogs();
    }
  }, [activeTab, fetchCalls, fetchLogs]);

  const handleDeleteCall = async () => {
    if (!callToDelete || !session) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/calls?id=${callToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir chamado.');
      setCallToDelete(null);
      fetchCalls();
    } catch (err: any) {
      alert(`⚠️ ${err.message || 'Falha ao excluir chamado.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!logToDelete || !session) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?id=${logToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir log.');
      setLogToDelete(null);
      fetchLogs();
    } catch (err: any) {
      alert(`⚠️ ${err.message || 'Falha ao excluir log.'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearAllLogs = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/logs?all=true', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao limpar logs.');
      setIsClearAllLogsModalOpen(false);
      fetchLogs();
    } catch (err: any) {
      alert(`⚠️ ${err.message || 'Falha ao limpar logs.'}`);
    } finally {
      setActionLoading(false);
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

  const filteredCalls = calls.filter((c) => {
    const q = callSearch.toLowerCase();
    const matchesSearch =
      c.url?.toLowerCase().includes(q) ||
      c.tenant?.name?.toLowerCase().includes(q) ||
      c.tenant?.email?.toLowerCase().includes(q);
    const matchesStatus = callStatusFilter ? c.status === callStatusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const filteredLogs = logs.filter((l) => {
    const q = logSearch.toLowerCase();
    const matchesSearch =
      l.message?.toLowerCase().includes(q) ||
      l.event_type?.toLowerCase().includes(q) ||
      l.tenant?.name?.toLowerCase().includes(q) ||
      l.tenant?.email?.toLowerCase().includes(q);
    const matchesLevel = logLevelFilter ? l.level === logLevelFilter : true;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl mb-8">
      {/* Header com Abas e Filtros */}
      <div className="p-5 border-b border-gray-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-950">
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-950 p-1 rounded-2xl border border-gray-800">
            <button
              onClick={() => setActiveTab('CALLS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'CALLS'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Chamados ({calls.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('LOGS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'LOGS'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Logs do Sistema ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* Controles de Busca e Filtro */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {activeTab === 'CALLS' ? (
            <>
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar prestador ou URL..."
                  value={callSearch}
                  onChange={(e) => setCallSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <select
                value={callStatusFilter}
                onChange={(e) => setCallStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">Todos Status</option>
                <option value="SUCCESS">Sucesso</option>
                <option value="FAILED">Falhas</option>
              </select>

              <button
                onClick={fetchCalls}
                disabled={callsLoading}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors shrink-0 disabled:opacity-50"
                title="Recarregar chamados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${callsLoading ? 'animate-spin' : ''}`} />
              </button>
            </>
          ) : (
            <>
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar mensagem ou evento..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">Todos Níveis</option>
                <option value="ERROR">ERROR</option>
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
              </select>

              <button
                onClick={() => setIsClearAllLogsModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Todos</span>
              </button>

              <button
                onClick={fetchLogs}
                disabled={logsLoading}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors shrink-0 disabled:opacity-50"
                title="Recarregar logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo da Aba Chamados */}
      {activeTab === 'CALLS' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-gray-950/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Prestador</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Distância</th>
                <th className="py-3 px-4">Prévia (Chegada)</th>
                <th className="py-3 px-4">Resposta</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {callsLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-32" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 bg-gray-800 rounded w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    Nenhum chamado encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredCalls.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {c.tenant?.name || 'Prestador Desconhecido'}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {c.tenant?.email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {c.status === 'SUCCESS' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sucesso
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Falha
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {c.distancia_km ? `${c.distancia_km} km` : '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-300 font-mono">
                      {c.previa_minutos || c.previa_valor ? `${c.previa_minutos || c.previa_valor} min` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-400">
                      {c.duration_ms} ms
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setCallToDelete(c)}
                        title="Excluir este chamado"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Conteúdo da Aba Logs */}
      {activeTab === 'LOGS' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-gray-950/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Nível</th>
                <th className="py-3 px-4">Prestador</th>
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Mensagem</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {logsLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-28" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-4 bg-gray-800 rounded w-48" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-4 bg-gray-800 rounded w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500">
                    Nenhum log encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {formatDate(l.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          l.level === 'ERROR'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : l.level === 'WARN'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {l.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-300">
                      {l.tenant?.name || 'Global / Sistema'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-purple-300 font-semibold">
                      {l.event_type}
                    </td>
                    <td className="py-3 px-4 text-gray-300 max-w-xs truncate" title={l.message}>
                      {l.message}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setLogToDelete(l)}
                        title="Excluir este log"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Exclusão de Chamado */}
      <DeleteConfirmModal
        isOpen={!!callToDelete}
        onClose={() => setCallToDelete(null)}
        onConfirm={handleDeleteCall}
        title="Excluir Chamado"
        description="Tem certeza que deseja remover este registro de chamado do sistema?"
        itemName={callToDelete ? `ID: ${callToDelete.id}` : undefined}
        confirmButtonText="Excluir Chamado"
        loading={actionLoading}
      />

      {/* Modal de Exclusão de Log */}
      <DeleteConfirmModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleDeleteLog}
        title="Excluir Registro de Log"
        description="Tem certeza que deseja remover esta linha de log de auditoria?"
        itemName={logToDelete ? `${logToDelete.event_type}: ${logToDelete.message}` : undefined}
        confirmButtonText="Excluir Log"
        loading={actionLoading}
      />

      {/* Modal de Limpeza Total de Logs */}
      <DeleteConfirmModal
        isOpen={isClearAllLogsModalOpen}
        onClose={() => setIsClearAllLogsModalOpen(false)}
        onConfirm={handleClearAllLogs}
        title="Limpar Todos os Logs"
        description="Tem certeza que deseja apagar permanentemente todos os registros de logs de auditoria do sistema?"
        confirmButtonText="Limpar Todos os Logs"
        loading={actionLoading}
      />
    </div>
  );
}
