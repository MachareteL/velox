'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage('Credenciais inválidas. Verifique seu e-mail e senha.');
        setLoading(false);
        return;
      }

      router.push('/');
    } catch (err: any) {
      setErrorMessage('Erro ao realizar login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-300 p-0.5 shadow-xl shadow-emerald-500/20 mx-auto mb-4 flex items-center justify-center transition-transform hover:scale-105">
            <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center">
              <Activity className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">VeloXON</h1>
          <p className="text-xs text-gray-400 mt-1">Acesse a plataforma de automação de convites</p>

        </div>

        {/* Card do Formulário */}
        <div className="glass-panel p-8 rounded-3xl border border-gray-800 shadow-2xl">
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium text-center">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">E-mail corporativo</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="prestador@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-950/90 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Senha de acesso</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-950/90 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                'Entrando...'
              ) : (
                <>
                  Entrar no Painel <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-800/80 text-center">
            <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Acesso restrito para prestadores cadastrados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
