'use client';

import React, { useState } from 'react';
import { UserPlus, X, Mail, Lock, User, Phone, Key, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          phoneNumber: phoneNumber.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cadastrar usuário.');
      }

      setSuccessMsg(`Prestador ${data.user?.name || name} cadastrado com sucesso!`);
      setTimeout(() => {
        onUserCreated();
        onClose();
        setName('');
        setEmail('');
        setPassword('');
        setPhoneNumber('');
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      console.error('[CreateUserModal] Erro:', err);
      setErrorMsg(err.message || 'Falha ao cadastrar usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-gray-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Cadastrar Novo Prestador</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Cria o login de acesso e inicializa as configurações do robô
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome do Prestador */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Nome do Prestador / Razão Social <span className="text-purple-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="Ex: Auto Socorro Silva / João da Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-950/90 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              E-mail de Acesso <span className="text-purple-400">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="prestador@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950/90 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Senha Inicial */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-300">
                Senha Inicial <span className="text-purple-400">*</span>
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                <Key className="w-3 h-3" />
                Gerar Senha Segura
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950/90 border border-gray-800 rounded-xl py-2.5 pl-10 pr-24 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300 hover:text-white transition-colors"
              >
                {showPassword ? 'Ocultar' : 'Exibir'}
              </button>
            </div>
          </div>

          {/* Telefone WhatsApp (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              WhatsApp Conectado (Opcional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Ex: 5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-gray-950/90 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600 font-mono"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              O prestador poderá escanear o QR Code ou gerar código de pareamento a qualquer momento.
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading || !name.trim() || !email.trim() || !password}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Criar Prestador</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
