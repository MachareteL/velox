'use client';

import React, { useState } from 'react';
import { X, QrCode, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Phone, Copy, Check } from 'lucide-react';
import type { WhatsAppSessionStatus } from '@velox/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { requestPhonePairingCode } from '@velox/database';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: WhatsAppSessionStatus;
  qrCode?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
}

export function QRModal({ isOpen, onClose, status, qrCode, pairingCode, phoneNumber }: QRModalProps) {
  const { user } = useAuth();
  const [connectMethod, setConnectMethod] = useState<'QR' | 'PHONE'>('QR');
  const [inputPhone, setInputPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Formatação com Máscara +55 (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 13) digits = digits.slice(0, 13);

    // Se o usuário não digitou DDI 55 no início, adiciona automaticamente
    if (digits.length > 0 && !digits.startsWith('55')) {
      digits = '55' + digits;
    }

    let formatted = '';
    if (digits.length > 0) {
      formatted = '+' + digits.slice(0, 2);
    }
    if (digits.length > 2) {
      formatted += ' (' + digits.slice(2, 4) + ') ';
    }
    if (digits.length > 4) {
      if (digits.length <= 9) {
        formatted += digits.slice(4);
      } else {
        formatted += digits.slice(4, 9) + '-' + digits.slice(9, 13);
      }
    }
    setInputPhone(formatted);
  };

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
            pairing_code: null,
            phone_number: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
        .select('*');

      if (error) {
        setErrorMessage('Não foi possível solicitar o QR Code no momento. Tente novamente.');
      }
    } catch {
      setErrorMessage('Falha ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const rawDigits = inputPhone.replace(/\D/g, '');
    if (rawDigits.length < 12) {
      setErrorMessage('Digite um número de telefone válido com DDI e DDD (ex: +55 11 99999-9999).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await requestPhonePairingCode(supabase, user.id, rawDigits);
      if (!result) {
        setErrorMessage('Falha ao solicitar o código de pareamento. Tente novamente.');
      }
    } catch {
      setErrorMessage('Erro ao comunicar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedPairingCode = pairingCode
    ? pairingCode.length === 8
      ? `${pairingCode.slice(0, 4)} - ${pairingCode.slice(4)}`
      : pairingCode
    : null;

  const isGenerating = loading || (status === 'DISCONNECTED_NEED_QR' && connectMethod === 'QR' && !qrCode) || (status === 'DISCONNECTED_NEED_QR' && connectMethod === 'PHONE' && !pairingCode && Boolean(phoneNumber));

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

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            {connectMethod === 'QR' ? <QrCode className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">Conectar WhatsApp</h3>
          <p className="text-xs text-gray-400 mt-1">
            Escolha como prefere vincular o WhatsApp da sua empresa ao Velox Automator.
          </p>
        </div>

        {/* Abas de Escolha do Método */}
        {status !== 'CONNECTED' && (
          <div className="grid grid-cols-2 gap-1 bg-gray-950 p-1.5 rounded-2xl border border-gray-800 mb-5">
            <button
              onClick={() => {
                setConnectMethod('QR');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                connectMethod === 'QR'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              QR Code (Câmera)
            </button>

            <button
              onClick={() => {
                setConnectMethod('PHONE');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                connectMethod === 'PHONE'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              Código por Número
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {/* Conteúdo Central */}
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
          ) : connectMethod === 'QR' ? (
            qrCode ? (
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
                  Gerando QR Code...
                </h4>
                <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed">
                  Iniciando a sessão do WhatsApp. Isso pode levar alguns segundos.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-300">Nenhum QR code ativo no momento.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Clique no botão abaixo para gerar um novo QR code.
                </p>
              </div>
            )
          ) : (
            /* Método por Número de Telefone */
            formattedPairingCode ? (
              <div className="flex flex-col items-center text-center w-full">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                  Código de Pareamento WhatsApp
                </span>
                
                <div className="px-6 py-4 bg-gray-900 rounded-2xl border border-emerald-500/40 shadow-xl mb-3 flex items-center gap-3">
                  <span className="font-mono text-2xl font-extrabold text-white tracking-widest">
                    {formattedPairingCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all hover:scale-105 active:scale-95"
                    title="Copiar Código"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {copied && <span className="text-xs text-emerald-400 font-bold mb-2">Código copiado com sucesso!</span>}

                <p className="text-xs text-gray-400 max-w-[280px] leading-relaxed">
                  Insira este código de 8 dígitos no seu celular para autorizar a conexão.
                </p>
              </div>
            ) : isGenerating ? (
              <div className="text-center py-8 flex flex-col items-center justify-center">
                <div className="relative mb-4 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <Loader2 className="w-6 h-6 text-emerald-400 absolute animate-spin" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  Solicitando Código ao WhatsApp...
                </h4>
                <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed">
                  Gerando o código de pareamento de 8 dígitos para o seu número.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestPairingCode} className="w-full">
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 text-left">
                  Número do WhatsApp (com DDI e DDD):
                </label>
                <input
                  type="text"
                  value={inputPhone}
                  onChange={handlePhoneChange}
                  placeholder="+55 (11) 99999-9999"
                  className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono mb-3"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  Gerar Código de 8 Dígitos
                </button>
              </form>
            )
          )}
        </div>

        {/* Instruções Passo a Passo */}
        {status !== 'CONNECTED' && (
          <div className="mt-5 pt-4 border-t border-gray-800/80">
            {connectMethod === 'QR' ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-400 mb-4">
                  <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                    <span className="block font-bold text-emerald-400 mb-0.5">Passo 1</span>
                    Abra o WhatsApp
                  </div>
                  <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                    <span className="block font-bold text-emerald-400 mb-0.5">Passo 2</span>
                    Aparelhos Conectados
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
                  {isGenerating ? 'Aguarde, gerando...' : 'Gerar Novo QR Code'}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-400">
                  <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                    <span className="block font-bold text-emerald-400 mb-0.5">Passo 1</span>
                    Aparelhos Conectados
                  </div>
                  <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                    <span className="block font-bold text-emerald-400 mb-0.5">Passo 2</span>
                    Conectar por Telefone
                  </div>
                  <div className="p-2 bg-gray-950 rounded-xl border border-gray-800">
                    <span className="block font-bold text-emerald-400 mb-0.5">Passo 3</span>
                    Digite o código de 8 dígitos
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
