'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, LogOut, LayoutDashboard, User as UserIcon, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function AdminNavbar() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-purple-900/40 bg-[#090d16]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Admin Badge */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-purple-500/20 flex items-center justify-center transition-transform group-hover:scale-105 shrink-0">
              <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">VeloXON</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADMINISTRADOR
                </span>
              </div>
              <p className="text-[11px] text-purple-300/70">Gestão Global & Telemetria do Sistema</p>
            </div>
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Link para o Dashboard do Prestador */}
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-800 bg-gray-900/80 hover:bg-gray-800/90 text-gray-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Ir para Painel do Prestador</span>
          </Link>

          {/* Perfil & Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-200">
                <UserIcon className="w-3.5 h-3.5 text-purple-400" />
                <span className="truncate max-w-[150px] font-medium">{user.email}</span>
              </div>

              <button
                onClick={signOut}
                title="Sair da conta"
                className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
