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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // Login exclusivo de prestadores previamente cadastrados no Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        router.push('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-gray-800 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-300 p-0.5 shadow-xl shadow-emerald-500/20 mx-auto mb-4 flex items-center justify-center">
            <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center">
              <Activity className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Velox SaaS Automator</h1>
          <p className="text-xs text-gray-400 mt-1">Acesso exclusivo para prestadores autorizados</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">E-mail Cadastrado</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="seu.email@prestador.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Senha de Acesso</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              'Autenticando...'
            ) : (
              <>
                Entrar no Painel
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-gray-800/80 text-center">
          <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Sistema fechado. Cadastros são realizados pelo administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
