'use client';

import React, { useState } from 'react';
import { X, QrCode, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleRequestQR = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase
        .from('whatsapp_sessions')
        .update({
          status: 'DISCONNECTED_NEED_QR',
          qr_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', user.id);
    } catch (err) {
      console.error('Erro ao solicitar QR Code:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Conexão via QR Code</h3>
          <p className="text-xs text-gray-400 mt-1">
            Escaneie o QR Code com o aplicativo WhatsApp no seu celular para autorizar o robô.
          </p>
        </div>

        <div className="bg-gray-950/80 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center min-h-[260px] relative">
          {status === 'CONNECTED' ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3 animate-bounce" />
              <h4 className="text-lg font-semibold text-white">WhatsApp Conectado!</h4>
              <p className="text-xs text-gray-400 mt-1">
                Sua automação está ativa e processando convites do Velox em milissegundos.
              </p>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center">
              <div className="p-3 bg-white rounded-xl shadow-lg border border-emerald-500/30">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52 object-contain" />
              </div>
              <p className="text-xs text-emerald-400 font-medium mt-3 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> QR Code ativo. Escaneie agora!
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm text-gray-300">Nenhum QR Code ativo no momento.</p>
              <p className="text-xs text-gray-500 mt-1">
                Clique no botão abaixo para solicitar a geração do QR Code ao Worker na VPS.
              </p>
            </div>
          )}
        </div>

        {status !== 'CONNECTED' && (
          <div className="mt-6">
            <button
              onClick={handleRequestQR}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Solicitando...' : 'Gerar Novo QR Code'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
