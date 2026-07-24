'use client';

import React, { useState } from 'react';
import { Truck, Plus, Trash2, Power, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Vehicle, CapturedCall } from '@velox/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

interface FleetManagerProps {
  vehicles: Vehicle[];
  calls: CapturedCall[];
  onRefreshVehicles: () => void;
}

export function FleetManager({ vehicles, calls, onRefreshVehicles }: FleetManagerProps) {
  const { user } = useAuth();
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeVehiclesCount = vehicles.filter((v) => v.is_active).length;

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('vehicles').insert([
        {
          tenant_id: user.id,
          title: newTitle.trim(),
          is_active: true,
        },
      ]);

      if (error) throw error;

      setNewTitle('');
      onRefreshVehicles();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar veículo.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVehicle = async (vehicleId: string, currentStatus: boolean) => {
    try {
      await supabase
        .from('vehicles')
        .update({ is_active: !currentStatus })
        .eq('id', vehicleId);

      onRefreshVehicles();
    } catch (err) {
      console.error('Erro ao alterar status do veículo:', err);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Deseja remover este veículo da frota?')) return;

    try {
      await supabase.from('vehicles').delete().eq('id', vehicleId);
      onRefreshVehicles();
    } catch (err) {
      console.error('Erro ao excluir veículo:', err);
    }
  };

  const getVehicleCallCount = (vehicleId: string) => {
    return calls.filter((c) => c.vehicle_id === vehicleId && c.status === 'SUCCESS').length;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            Gestão de Frota e Capacidade Simultânea
          </h2>
          <p className="text-xs text-gray-400">
            Cadastre seus veículos. A capacidade de chamados simultâneos aceitos pelo sistema é ajustada automaticamente pela quantidade de veículos ativos.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Frota Operacional: {activeVehiclesCount} {activeVehiclesCount === 1 ? 'Veículo' : 'Veículos'} ({activeVehiclesCount} {activeVehiclesCount === 1 ? 'chamado simultâneo' : 'chamados simultâneos'})
        </span>
      </div>

      {/* Formulário de Cadastro Simplificado */}
      <form onSubmit={handleAddVehicle} className="flex items-center gap-3 mb-6">
        <input
          type="text"
          required
          placeholder="Identificação do veículo (ex: Guincho 01, Placa ABC-1234)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
        />
        <button
          type="submit"
          disabled={loading || !newTitle.trim()}
          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Adicionando...' : 'Adicionar Veículo'}
        </button>
      </form>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
          {errorMsg}
        </div>
      )}

      {/* Lista de Veículos */}
      {vehicles.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl">
          <Truck className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Nenhum veículo cadastrado ainda na frota.</p>
          <p className="text-xs text-gray-600 mt-0.5">Adicione a identificação dos seus veículos acima para habilitar múltiplos atendimentos simultâneos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map((v) => {
            const count = getVehicleCallCount(v.id);
            return (
              <div
                key={v.id}
                className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                  v.is_active
                    ? 'bg-gray-950/60 border-gray-800 hover:border-emerald-500/30'
                    : 'bg-gray-950/30 border-gray-900 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleVehicle(v.id, v.is_active)}
                    title={v.is_active ? 'Clique para colocar em manutenção/indisponível' : 'Clique para colocar em operação'}
                    className={`p-2 rounded-lg transition-colors ${
                      v.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {v.title}
                      {!v.is_active && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                          Manutenção
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {count} {count === 1 ? 'atendimento realizado' : 'atendimentos realizados'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteVehicle(v.id)}
                  title="Remover veículo"
                  className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
