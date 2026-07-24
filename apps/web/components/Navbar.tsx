'use client';

import React from 'react';
import { Activity, QrCode, LogOut, User as UserIcon, Power, PauseCircle, PlayCircle } from 'lucide-react';
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
            Desconectado
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
              Velox Automator
            </h1>
            <p className="text-xs text-gray-400">Automação Inteligente de Convites</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botão / Switch ON/OFF de Aceite Automático */}
          <button
            onClick={onToggleActive}
            title={isActive ? 'Clique para pausar aceites automáticos' : 'Clique para ligar aceites automáticos'}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-lg ${
              isActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-emerald-500/10'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shadow-amber-500/10'
            }`}
          >
            {isActive ? (
              <>
                <PlayCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Aceite Automático: <strong className="uppercase">LIGADO</strong></span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-amber-400" />
                <span>Aceite Automático: <strong className="uppercase">PAUSADO</strong></span>
              </>
            )}
          </button>

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
                title="Sair do sistema"
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
