'use client';

import React, { useState } from 'react';
import { X, Send, Bell, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { SendTestPushResponse } from '@/lib/admin/types';

interface SendPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  onPushSent?: () => void;
}

export function SendPushModal({
  isOpen,
  onClose,
  targetUser,
  onPushSent,
}: SendPushModalProps) {
  const { session } = useAuth();
  const [title, setTitle] = useState('🔔 Teste VeloXON');
  const [body, setBody] = useState('Esta é uma notificação de teste enviada pelo administrador.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendTestPushResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !targetUser) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetTenantId: targetUser.id,
          title,
          body,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar notificação de teste.');
      }

      setResult(data);
      if (onPushSent) onPushSent();
    } catch (err: any) {
      console.error('[SendPushModal] Erro:', err);
      setError(err?.message || 'Ocorreu um erro ao enviar a notificação.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border border-purple-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Testar Notificação Web Push</h3>
              <p className="text-xs text-gray-400">
                Disparar teste direto para o dispositivo do prestador
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSend} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 text-xs">
            <span className="text-gray-400">Destinatário:</span>
            <div className="font-bold text-purple-300 text-sm mt-0.5">{targetUser.name}</div>
            <div className="text-gray-400 font-mono text-[11px]">{targetUser.email}</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Título da Notificação
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="Digite o título..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Mensagem da Notificação
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors resize-none"
              placeholder="Digite a mensagem..."
              required
            />
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{result.message || 'Push processado!'}</span>
              </div>
              <div className="text-[11px] text-gray-300 font-mono pt-1">
                Enviados: <strong className="text-emerald-300">{result.sentCount}</strong> | Falhas:{' '}
                <strong className="text-amber-300">{result.failedCount}</strong> | Subscriptions:{' '}
                {result.totalSubscriptions}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar Notificação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
