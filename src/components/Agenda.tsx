/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronLeft, ArrowRight, CalendarDays, Search, Printer, Sparkles, DollarSign, MessageSquare } from 'lucide-react';

export function AgendaSubHeader() {
  return (
    <div className="px-4 md:px-8 py-3 md:py-4 bg-white border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
      <div className="flex items-center justify-between w-full sm:w-auto gap-4 md:gap-8">
        <div className="flex items-center gap-3">
          <button className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">QUINTA,</span>
            <span className="text-xs md:text-sm font-bold text-slate-700">3 DE ABRIL</span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <button className="flex items-center gap-1.5 md:gap-2 text-blue-600 hover:text-blue-700 font-bold text-xs md:text-sm">
            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-blue-600 rounded-full flex items-center justify-center">
              <ArrowRight size={12} className="rotate-[-135deg]" />
            </div>
            <span className="hidden xs:inline">Hoje</span>
          </button>
          <div className="bg-slate-50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-slate-200 flex items-center gap-2 md:gap-3">
            <span className="text-xs md:text-sm font-medium text-slate-600">3/4/2025</span>
            <CalendarDays size={14} className="text-slate-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between w-full sm:w-auto gap-4 md:gap-6">
        <div className="flex bg-slate-50 p-1 rounded-xl flex-1 sm:flex-initial">
          <button className="flex-1 sm:px-4 md:px-6 py-1.5 text-[10px] md:text-sm font-bold bg-white text-blue-600 shadow-sm rounded-lg transition-all">Lista</button>
          <button className="flex-1 sm:px-4 md:px-6 py-1.5 text-[10px] md:text-sm font-bold text-slate-400">Mês</button>
          <button className="hidden md:block md:px-6 py-1.5 text-[10px] md:text-sm font-bold text-slate-400">Múlt. Dia</button>
          <button className="hidden lg:block lg:px-6 py-1.5 text-[10px] md:text-sm font-bold text-slate-400">Semana</button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
            <Search size={18} />
          </button>
          <button className="hidden sm:block p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
            <Printer size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

import { MOCK_APPOINTMENTS, AppointmentStatus } from '../types';

const statusConfig: Record<AppointmentStatus, { label: string; color: string; border: string; bg: string }> = {
  atendido: { label: 'ATENDIDO', color: 'text-green-600', border: 'border-green-500', bg: 'bg-green-50' },
  em_atendimento: { label: 'EM ATENDIMENTO', color: 'text-green-600', border: 'border-green-500', bg: 'bg-green-50' },
  paciente_no_local: { label: 'PACIENTE NO LOCAL', color: 'text-blue-600', border: 'border-blue-500', bg: 'bg-blue-50' },
  confirmado: { label: 'CONFIRMADO', color: 'text-blue-600', border: 'border-blue-500', bg: 'bg-blue-50' },
  agendado: { label: 'AGENDADO', color: 'text-slate-500', border: 'border-slate-300', bg: 'bg-slate-50' },
  desmarcado: { label: 'DESMARCADO', color: 'text-rose-400', border: 'border-rose-300', bg: 'bg-rose-50' },
};

export function AppointmentTable() {
  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="hidden lg:grid grid-cols-[100px_minmax(200px,2.5fr)_minmax(150px,1.5fr)_minmax(150px,1.5fr)_minmax(150px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_120px] gap-4 mb-6 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 py-4 rounded-xl border border-slate-100">
        <div>Horário</div>
        <div>Paciente</div>
        <div>Status</div>
        <div>Atendimento</div>
        <div className="flex items-center gap-1">
          Observações
          <Sparkles size={10} className="text-blue-400" />
        </div>
        <div>Chegada</div>
        <div>Prontuário</div>
        <div>Pagamento</div>
        <div></div>
      </div>

      <div className="space-y-4">
        {MOCK_APPOINTMENTS.map((apt) => {
          const config = statusConfig[apt.status];
          return (
            <div 
              key={apt.id} 
              className={`flex flex-col lg:grid lg:grid-cols-[100px_minmax(200px,2.5fr)_minmax(150px,1.5fr)_minmax(150px,1.5fr)_minmax(150px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_120px] items-start lg:items-center gap-4 py-5 px-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group cursor-pointer`}
            >
              <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0 w-full lg:w-auto">
                <span className="text-sm font-bold text-slate-800">{apt.timeStart}</span>
                <span className="text-xs font-bold text-slate-400 lg:mt-1">até {apt.timeEnd}</span>
              </div>

              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden shrink-0">
                   <div className="w-full h-full bg-slate-200" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{apt.patientName}</span>
                  <span className="lg:hidden text-[10px] font-bold text-slate-500 uppercase">{apt.type}</span>
                </div>
              </div>

              <div className="flex lg:items-center">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} border-none`}>
                  <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                  <span className={`text-[10px] font-black ${config.color}`}>{config.label}</span>
                </div>
              </div>

              <div className="hidden lg:flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Procedimento</span>
                <span className="text-xs font-bold text-slate-700">{apt.type}</span>
              </div>

              <div className="text-xs font-medium text-slate-500 lg:line-clamp-2 italic pr-4">
                {apt.observations || <span className="text-slate-300">Nenhuma observação</span>}
              </div>

              <div className="flex lg:block items-center gap-2 lg:gap-0">
                <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase">Chegada:</span>
                <span className="text-xs font-bold text-slate-400 font-mono">{apt.arrival}</span>
              </div>

              <div className="flex lg:block items-center gap-2 lg:gap-0">
                <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase">Pront.:</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                  apt.recordStatus === 'incluso' ? 'bg-green-50 text-green-600' : 
                  apt.recordStatus === 'pendente' ? 'bg-amber-50 text-amber-600' : 
                  'bg-slate-50 text-slate-300'
                }`}>
                  {apt.recordStatus === 'incluso' ? 'Incluso' : 
                   apt.recordStatus === 'pendente' ? 'Pendente' : 
                   'Desm.'}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className={`p-1.5 rounded-lg ${apt.paymentStatus === 'paid' ? 'bg-green-50' : apt.paymentStatus === 'pending' ? 'bg-blue-50' : 'bg-red-50'}`}>
                  <DollarSign size={16} className={apt.paymentStatus === 'paid' ? 'text-green-600' : apt.paymentStatus === 'pending' ? 'text-blue-600' : 'text-red-500'} />
                </div>
              </div>

              <div className="flex justify-end w-full lg:w-auto">
                <button 
                  disabled={apt.status === 'desmarcado'}
                  className={`flex items-center justify-between w-full lg:w-[120px] px-4 py-3 md:py-2.5 bg-blue-600 text-white rounded-xl shadow-sm hover:shadow-md hover:bg-blue-700 transition-all text-[11px] font-black disabled:opacity-20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none`}
                >
                  <span>ATENDER</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
