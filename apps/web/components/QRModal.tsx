'use client';

import React, { useState } from 'react';
import { X, QrCode, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { WhatsAppSessionStatus } from '@velox/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: WhatsAppSessionStatus;
  qrCode?: string | null;
}

export function QRModal({ isOpen, onClose, status, qrCode }: QRModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestQR = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('whatsapp_sessions')
        .upsert(
          {
            tenant_id: user.id,
            status: 'DISCONNECTED_NEED_QR',
            qr_code: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
        .select('*');

      if (error) {
        setErrorMessage('Não foi possível solicitar o QR Code no momento. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMessage('Falha ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isGenerating = loading || (status === 'DISCONNECTED_NEED_QR' && !qrCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Glow de Fundo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">Conectar WhatsApp</h3>
          <p className="text-xs text-gray-400 mt-1">
            Siga os passos abaixo para conectar o WhatsApp da sua empresa ao Velox Automator.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {/* Quadro Central do QR Code */}
        <div className="bg-gray-950/90 rounded-2xl border border-gray-800 p-6 flex flex-col items-center justify-center min-h-[260px] relative">
          {status === 'CONNECTED' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <h4 className="text-lg font-bold text-white">WhatsApp Conectado!</h4>
              <p className="text-xs text-gray-400 mt-1">
                Sua automação está ativa e aceitando os convites recebidos.
              </p>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center">
              <div className="p-3.5 bg-white rounded-2xl shadow-2xl border-2 border-emerald-500/50 glow-emerald">
                <img src={qrCode} alt="QR Code WhatsApp" className="w-52 h-52 object-contain" />
              </div>
              <p className="text-xs text-emerald-400 font-semibold mt-4 flex items-center gap-1.5 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-800/40">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Código pronto. Escaneie agora!
              </p>
            </div>
          ) : isGenerating ? (
            <div className="text-center py-8 flex flex-col items-center justify-center">
              <div className="relative mb-4 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <Loader2 className="w-6 h-6 text-emerald-400 absolute animate-spin" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Aguarde, seu QR code está sendo gerado...
              </h4>
              <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed">
                Iniciando a sessão do WhatsApp. Isso pode levar alguns segundos.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-300">Nenhum código ativo no momento.</p>
              <p className="text-xs text-gray-500 mt-1">
                Clique no botão abaixo para gerar um novo código de conexão.
              </p>
            </div>
          )}
        </div>

        {/* Passo a Passo Ilustrado */}
        {status !== 'CONNECTED' && (
          <div className="mt-5 pt-4 border-t border-gray-800/80">
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-400 mb-4">
              <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                <span className="block font-bold text-emerald-400 mb-0.5">Passo 1</span>
                Abra o WhatsApp
              </div>
              <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                <span className="block font-bold text-emerald-400 mb-0.5">Passo 2</span>
                Dispositivos Conectados
              </div>
              <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                <span className="block font-bold text-emerald-400 mb-0.5">Passo 3</span>
                Escaneie o código
              </div>
            </div>

            <button
              onClick={handleRequestQR}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Aguarde, seu QR code está sendo gerado...' : 'Gerar Novo QR Code'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
