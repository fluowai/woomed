/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Users, 
  Calendar, 
  ClipboardList, 
  DollarSign, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Plus, 
  UserPlus, 
  ShieldAlert 
} from 'lucide-react';
import { Appointment, Patient, Doctor } from '../types';

interface DashboardProps {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  currentDate: string;
  onViewChange: (view: any) => void;
  onNewAppointment: () => void;
  onNewPatient: () => void;
}

export default function Dashboard({ 
  appointments, 
  patients, 
  doctors, 
  currentDate, 
  onViewChange,
  onNewAppointment,
  onNewPatient
}: DashboardProps) {
  
  // Calculate today's stats
  const todayAppointments = appointments.filter(a => a.date === currentDate);
  const attendedCount = todayAppointments.filter(a => a.status === 'atendido' || a.status === 'em_atendimento').length;
  const pendingRecords = todayAppointments.filter(a => a.recordStatus === 'pendente').length;
  
  // Estimate daily billing
  const dailyBilling = todayAppointments.reduce((acc, curr) => {
    if (curr.status === 'desmarcado') return acc;
    // Private consultations cost 300, convenio cost 150, return is free
    let cost = 0;
    if (curr.type.toLowerCase().includes('particular')) cost = 300;
    else if (curr.type.toLowerCase().includes('convênio') || curr.type.toLowerCase().includes('convenio')) cost = 150;
    else if (curr.type.toLowerCase().includes('primeira')) cost = 250;
    return acc + cost;
  }, 0);

  const awaitingCount = todayAppointments.filter(a => a.status === 'paciente_no_local').length;

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 rounded-[32px] p-6 md:p-8 text-white shadow-xl shadow-teal-100 mb-8 relative overflow-hidden group">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10 group-hover:scale-110 transition-transform duration-700">
          <Calendar size={300} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase mb-4 text-blue-100">
            <Sparkles size={12} className="animate-pulse" />
            <span>Consultio Med Intellisense</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Olá, Dr. Matheus!</h2>
          <p className="text-sm md:text-base text-blue-100/90 font-medium leading-relaxed">
            Você tem <strong className="text-white font-bold">{todayAppointments.length} atendimentos</strong> programados para hoje. 
            {awaitingCount > 0 ? ` Há ${awaitingCount} paciente(s) aguardando na recepção neste momento.` : " Tudo pronto para iniciar seus atendimentos!"}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* KPI 1 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Consultas Hoje</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{todayAppointments.length}</span>
              <span className="text-[10px] font-bold text-slate-500">agendadas</span>
            </div>
            <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> {attendedCount} concluídos
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Calendar size={24} />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pacientes na Fila</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">{awaitingCount}</span>
              <span className="text-[10px] font-bold text-slate-500">no local</span>
            </div>
            <span className="text-[10px] text-blue-600 font-bold">Aguardando atendimento</span>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Clock size={24} />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Prontuários Pendentes</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600">{pendingRecords}</span>
              <span className="text-[10px] font-bold text-slate-500">evoluções</span>
            </div>
            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
              <ShieldAlert size={12} /> Requer atenção pós-consulta
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <ClipboardList size={24} />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Faturamento Estimado</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-green-700">R$ {dailyBilling}</span>
            </div>
            <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
              <TrendingUp size={12} /> Com base nos procedimentos
            </span>
          </div>
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid: Realtime Table & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Today's Appointments Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-800 tracking-tight">Fila de Atendimento de Hoje</h3>
                <p className="text-xs text-slate-400 font-medium">Lista ordenada por horário</p>
              </div>
              <button 
                onClick={() => onViewChange('Agenda')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
              >
                <span>Ver Agenda Completa</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center shrink-0">
                      <span className="text-sm font-black text-slate-800 block">{apt.timeStart}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">até {apt.timeEnd}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div>
                      <span className="text-sm font-black text-slate-900 uppercase block">{apt.patientName}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{apt.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                      apt.status === 'atendido' ? 'bg-green-50 text-green-600' :
                      apt.status === 'em_atendimento' ? 'bg-emerald-50 text-emerald-600 animate-pulse' :
                      apt.status === 'paciente_no_local' ? 'bg-blue-50 text-blue-600' :
                      apt.status === 'confirmado' ? 'bg-indigo-50 text-indigo-600' :
                      apt.status === 'desmarcado' ? 'bg-rose-50 text-rose-500' :
                      'bg-slate-50 text-slate-400'
                    }`}>
                      {apt.status.replace('_', ' ')}
                    </span>

                    <button
                      onClick={() => onViewChange('Agenda')}
                      disabled={apt.status === 'desmarcado'}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 disabled:opacity-20 transition-colors"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {todayAppointments.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic text-sm">
                  Nenhum atendimento agendado para o dia de hoje.
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-3 text-sm">Pacientes Cadastrados</h4>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-slate-800">{patients.length}</span>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Totais</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Acesso imediato a prontuários eletrônicos, dados cadastrais e histórico de exames.
              </p>
              <button 
                onClick={() => onViewChange('Pacientes')}
                className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Gerenciar Pacientes</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-3 text-sm">Médicos no Corpo Clínico</h4>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-slate-800">{doctors.length}</span>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Profissionais</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Controle de agendas compartilhadas, horários de atendimento e especialidades clínicas.
              </p>
              <div className="flex gap-2 mt-4">
                {doctors.map(d => (
                  <span key={d.id} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                    {d.name.split(' ')[0]} {d.name.split(' ')[1] || ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Actions Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm flex flex-col space-y-4">
            <h3 className="font-black text-slate-800 tracking-tight mb-2">Ações Rápidas</h3>
            
            <button 
              onClick={onNewAppointment}
              className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl font-bold transition-all text-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <span>Novo Agendamento</span>
              </div>
              <ArrowRight size={18} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={onNewPatient}
              className="w-full flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl font-bold transition-all text-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                <span>Cadastrar Paciente</span>
              </div>
              <ArrowRight size={18} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => onViewChange('Assistente IA')}
              className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold transition-all text-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <span>Perguntar ao Assistente IA</span>
              </div>
              <ArrowRight size={18} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => onViewChange('Prontuários')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold transition-all text-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-600 text-white rounded-xl flex items-center justify-center">
                  <ClipboardList size={20} />
                </div>
                <span>Consultar Prontuários</span>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* AI Helper Quick Tip Box */}
          <div className="bg-teal-50 border border-teal-100 rounded-[32px] p-6 text-teal-900 shadow-sm overflow-hidden relative">
            <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-4 translate-y-4">
              <Sparkles size={120} className="text-teal-500" />
            </div>
            <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles size={14} className="animate-spin duration-10000" />
              Dica do Assistente IA
            </h4>
            <p className="text-xs text-teal-800 leading-relaxed font-medium">
              "Você sabia que pode pedir para o Assistente IA analisar a agenda do Dr. Matheus ou Dra. Ana Paula em tempo real para encontrar horários alternativos para pacientes? Basta clicar em Assistente IA na barra lateral!"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
