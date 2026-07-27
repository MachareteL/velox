'use client';

import React from 'react';
import { Activity, QrCode, LogOut, User as UserIcon, Power, Play, Pause } from 'lucide-react';
import type { WhatsAppSessionStatus } from '@velox/types';
import { useAuth } from '../lib/auth-context';

interface NavbarProps {
  status: WhatsAppSessionStatus;
  isActive: boolean;
  onToggleActive: () => void;
  onOpenQR: () => void;
}

export function Navbar({ status, isActive, onToggleActive, onOpenQR }: NavbarProps) {
  const { user, signOut } = useAuth();

  const getStatusBadge = () => {
    switch (status) {
      case 'CONNECTED':
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner shrink-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">WhatsApp </span>Conectado
          </div>
        );
      case 'AUTHENTICATING':
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-inner shrink-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="hidden sm:inline">Autenticando... </span>Aguarde
          </div>
        );
      case 'DISCONNECTED_NEED_QR':
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner shrink-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="hidden sm:inline">Aguardando </span>QR Code
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20 shrink-0">
            <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
            Desconectado
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-300 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center transition-transform hover:scale-105 shrink-0">
            <div className="w-full h-full bg-gray-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-2 truncate">
              Velox Automator
            </h1>
            <p className="hidden sm:block text-[11px] text-gray-400">Automação Inteligente de Convites</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Switch Estilo iOS para Automação LIGADA/PAUSADA */}
          <div
            onClick={onToggleActive}
            className={`cursor-pointer flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-300 select-none ${
              isActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10 hover:bg-emerald-500/15'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10 hover:bg-amber-500/15'
            }`}
            title={isActive ? 'Clique para pausar aceites automáticos' : 'Clique para ligar aceites automáticos'}
          >
            {/* Visual Slider Knob */}
            <div className={`w-7 sm:w-8 h-4 rounded-full p-0.5 transition-colors duration-300 relative shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${isActive ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'}`}>
                {isActive ? <Play className="w-2 h-2 text-emerald-600 fill-emerald-600" /> : <Pause className="w-2 h-2 text-gray-700 fill-gray-700" />}
              </div>
            </div>
            <span className="hidden sm:inline">
              Automação: <strong className="uppercase">{isActive ? 'LIGADA' : 'PAUSADA'}</strong>
            </span>
          </div>

          {getStatusBadge()}

          {/* Botão Conectar WhatsApp */}
          <button
            onClick={onOpenQR}
            className="flex items-center gap-2 px-2.5 sm:px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Conectar WhatsApp</span>
          </button>

          {/* Perfil do Usuário */}
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-gray-800 shrink-0">
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300">
                <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[140px] font-medium">{user.email}</span>
              </div>

              <button
                onClick={signOut}
                title="Sair do sistema"
                className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all shrink-0"
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
