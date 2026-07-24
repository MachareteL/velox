'use client';

import React from 'react';
import { Activity, QrCode, LogOut, User as UserIcon } from 'lucide-react';
import type { WhatsAppSessionStatus } from '@velox/types';
import { useAuth } from '../lib/auth-context';

interface NavbarProps {
  status: WhatsAppSessionStatus;
  onOpenQR: () => void;
}

export function Navbar({ status, onOpenQR }: NavbarProps) {
  const { user, signOut } = useAuth();

  const getStatusBadge = () => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            WhatsApp Conectado
          </span>
        );
      case 'DISCONNECTED_NEED_QR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Aguardando QR Code
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Erro na Conexão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Desconectado
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-300 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-gray-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
              Velox SaaS <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">Multi-Tenant</span>
            </h1>
            <p className="text-xs text-gray-400">Automação Velox em Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {getStatusBadge()}

          <button
            onClick={onOpenQR}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            Conectar WhatsApp
          </button>

          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-gray-800">
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-300">
                <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[150px]">{user.email}</span>
              </div>

              <button
                onClick={signOut}
                title="Sair da conta"
                className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
