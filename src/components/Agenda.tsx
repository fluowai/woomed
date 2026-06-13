/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  Search, 
  Printer, 
  Sparkles, 
  DollarSign, 
  ArrowRight, 
  Calendar as CalendarIcon,
  CheckCircle,
  X 
} from 'lucide-react';
import { Appointment, AppointmentStatus, Patient } from '../types';

interface AgendaSubHeaderProps {
  currentDate: string;
  onDateChange: (dateStr: string) => void;
  viewMode: 'list' | 'month';
  onViewModeChange: (mode: 'list' | 'month') => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export function AgendaSubHeader({
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange
}: AgendaSubHeaderProps) {
  
  // Format selected date nicely (e.g., "QUINTA, 3 DE ABRIL")
  const formatDateLabel = (dateStr: string) => {
    const daysWeek = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    const months = [
      'DE JANEIRO', 'DE FEVEREIRO', 'DE MARÇO', 'DE ABRIL', 
      'DE MAIO', 'DE JUNHO', 'DE JULHO', 'DE AGOSTO', 
      'DE SETEMBRO', 'DE OUTUBRO', 'DE NOVEMBRO', 'DE DEZEMBRO'
    ];
    const dateObj = new Date(dateStr + 'T00:00:00');
    if (isNaN(dateObj.getTime())) return { week: 'DATA', dayMonth: 'SELECIONADA' };
    
    return {
      week: daysWeek[dateObj.getDay()] + ',',
      dayMonth: `${dateObj.getDate()} ${months[dateObj.getMonth()]}`
    };
  };

  const { week, dayMonth } = formatDateLabel(currentDate);

  const shiftDate = (days: number) => {
    const dateObj = new Date(currentDate + 'T00:00:00');
    dateObj.setDate(dateObj.getDate() + days);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    onDateChange(`${yyyy}-${mm}-${dd}`);
  };

  const setToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    onDateChange(`${yyyy}-${mm}-${dd}`);
  };

  return (
    <div className="px-4 md:px-8 py-3 md:py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4 shadow-sm z-10">
      <div className="flex items-center justify-between w-full sm:w-auto gap-4 md:gap-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => shiftDate(-1)}
            className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{week}</span>
            <span className="text-xs md:text-sm font-black text-slate-700 tracking-tight">{dayMonth}</span>
          </div>
          <button 
            onClick={() => shiftDate(1)}
            className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={setToday}
            className="flex items-center gap-1.5 md:gap-2 text-blue-600 hover:text-blue-700 font-bold text-xs md:text-sm"
          >
            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-blue-600 rounded-full flex items-center justify-center">
              <ArrowRight size={12} className="rotate-[-135deg]" />
            </div>
            <span>Hoje</span>
          </button>
          <div className="bg-slate-50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-slate-200 flex items-center gap-2 md:gap-3">
            <input 
              type="date" 
              value={currentDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer"
            />
            <CalendarDays size={14} className="text-slate-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between w-full sm:w-auto gap-4 md:gap-6">
        <div className="flex bg-slate-100 p-1 rounded-xl flex-1 sm:flex-initial">
          <button 
            onClick={() => onViewModeChange('list')}
            className={`flex-1 sm:px-6 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'
            }`}
          >
            Lista
          </button>
          <button 
            onClick={() => onViewModeChange('month')}
            className={`flex-1 sm:px-6 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'
            }`}
          >
            Mês
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none w-36 sm:w-48 transition-all"
            />
          </div>
          <button 
            onClick={() => window.print()}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="Imprimir Agenda"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

const statusConfig: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  atendido: { label: 'ATENDIDO', color: 'text-green-600 bg-green-50', bg: 'bg-green-500' },
  em_atendimento: { label: 'EM ATENDIMENTO', color: 'text-emerald-700 bg-emerald-50', bg: 'bg-emerald-500' },
  paciente_no_local: { label: 'PACIENTE NO LOCAL', color: 'text-blue-600 bg-blue-50', bg: 'bg-blue-500' },
  confirmado: { label: 'CONFIRMADO', color: 'text-indigo-600 bg-indigo-50', bg: 'bg-indigo-500' },
  agendado: { label: 'AGENDADO', color: 'text-slate-500 bg-slate-100', bg: 'bg-slate-400' },
  desmarcado: { label: 'DESMARCADO', color: 'text-rose-500 bg-rose-50', bg: 'bg-rose-500' },
};

interface AppointmentTableProps {
  appointments: Appointment[];
  patients: Patient[];
  searchTerm: string;
  onUpdateStatus: (id: string, newStatus: AppointmentStatus) => void;
  onStartConsultation: (id: string, patientName: string) => void;
}

export function AppointmentTable({ 
  appointments, 
  patients, 
  searchTerm, 
  onUpdateStatus, 
  onStartConsultation 
}: AppointmentTableProps) {
  
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  // Filter local search
  const filtered = appointments.filter(apt => 
    apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    apt.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPatientAvatar = (name: string) => {
    const match = patients.find(p => p.fullName.toUpperCase() === name.toUpperCase());
    return match?.avatarUrl;
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      {/* Header labels */}
      <div className="hidden lg:grid grid-cols-[100px_minmax(200px,2.5fr)_minmax(180px,1.5fr)_minmax(150px,1.5fr)_minmax(150px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_120px] gap-4 mb-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 py-4 rounded-xl border border-slate-100">
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

      <div className="space-y-4 pb-20">
        {filtered.map((apt) => {
          const config = statusConfig[apt.status] || statusConfig.agendado;
          const avatarUrl = getPatientAvatar(apt.patientName);

          return (
            <div 
              key={apt.id} 
              className={`flex flex-col lg:grid lg:grid-cols-[100px_minmax(200px,2.5fr)_minmax(180px,1.5fr)_minmax(150px,1.5fr)_minmax(150px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_120px] items-start lg:items-center gap-4 py-5 px-6 bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group`}
            >
              {/* Time */}
              <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0 w-full lg:w-auto">
                <span className="text-sm font-black text-slate-800">{apt.timeStart}</span>
                <span className="text-xs font-bold text-slate-400 lg:mt-1">até {apt.timeEnd}</span>
              </div>

              {/* Patient */}
              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-slate-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden shrink-0">
                   {avatarUrl ? (
                     <img src={avatarUrl} alt={apt.patientName} className="w-full h-full object-cover" />
                   ) : (
                     <span>{apt.patientName.charAt(0)}</span>
                   )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">{apt.patientName}</span>
                  <span className="lg:hidden text-[9px] font-bold text-slate-500 uppercase mt-1">{apt.type}</span>
                </div>
              </div>

              {/* Status Selector Dropdown */}
              <div className="flex lg:items-center relative">
                {editingStatusId === apt.id ? (
                  <select 
                    value={apt.status}
                    onChange={(e) => {
                      onUpdateStatus(apt.id, e.target.value as AppointmentStatus);
                      setEditingStatusId(null);
                    }}
                    onBlur={() => setEditingStatusId(null)}
                    autoFocus
                    className="text-[10px] font-black border border-slate-200 rounded-xl px-2.5 py-1 bg-white outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="agendado">AGENDADO</option>
                    <option value="confirmado">CONFIRMADO</option>
                    <option value="paciente_no_local">PACIENTE NO LOCAL</option>
                    <option value="em_atendimento">EM ATENDIMENTO</option>
                    <option value="atendido">ATENDIDO</option>
                    <option value="desmarcado">DESMARCADO</option>
                  </select>
                ) : (
                  <button 
                    onClick={() => setEditingStatusId(apt.id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.color} border-none font-bold text-[9px] uppercase hover:ring-2 hover:ring-blue-100 transition-all`}
                    title="Clique para alterar o status"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${config.bg}`} />
                    <span className="font-black">{config.label}</span>
                  </button>
                )}
              </div>

              {/* Procedure */}
              <div className="hidden lg:flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Procedimento</span>
                <span className="text-xs font-bold text-slate-700">{apt.type}</span>
              </div>

              {/* Observations */}
              <div className="text-xs font-medium text-slate-500 lg:line-clamp-2 italic pr-4">
                {apt.observations || <span className="text-slate-300">Nenhuma observação</span>}
              </div>

              {/* Arrival */}
              <div className="flex lg:block items-center gap-2 lg:gap-0">
                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase">Chegada:</span>
                <span className="text-xs font-bold text-slate-400 font-mono">{apt.arrival || 'N/A'}</span>
              </div>

              {/* Medical Record Indicator */}
              <div className="flex lg:block items-center gap-2 lg:gap-0">
                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase">Pront.:</span>
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                  apt.recordStatus === 'incluso' ? 'bg-green-50 text-green-600' : 
                  apt.recordStatus === 'pendente' ? 'bg-amber-50 text-amber-600' : 
                  'bg-slate-100 text-slate-400'
                }`}>
                  {apt.recordStatus === 'incluso' ? 'Incluso' : 
                   apt.recordStatus === 'pendente' ? 'Pendente' : 
                   'Desm.'}
                </span>
              </div>

              {/* Payment Pill */}
              <div className="flex items-center gap-4">
                <div className={`p-1.5 rounded-xl ${apt.paymentStatus === 'paid' ? 'bg-green-50' : apt.paymentStatus === 'pending' ? 'bg-blue-50' : 'bg-rose-50'}`}>
                  <DollarSign size={16} className={apt.paymentStatus === 'paid' ? 'text-green-600' : apt.paymentStatus === 'pending' ? 'text-blue-600' : 'text-rose-500'} />
                </div>
              </div>

              {/* Consult button */}
              <div className="flex justify-end w-full lg:w-auto">
                <button 
                  onClick={() => onStartConsultation(apt.id, apt.patientName)}
                  disabled={apt.status === 'desmarcado' || apt.status === 'atendido'}
                  className={`flex items-center justify-between w-full lg:w-[120px] px-4 py-3 md:py-2.5 bg-blue-600 text-white rounded-xl shadow-sm hover:shadow-md hover:bg-blue-700 transition-all text-[11px] font-black uppercase tracking-wider disabled:opacity-20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none`}
                >
                  <span>{apt.status === 'em_atendimento' ? 'ATENDENDO' : 'ATENDER'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-20 text-center bg-white border border-slate-200 rounded-[32px]">
            <CalendarIcon size={48} className="mx-auto mb-4 text-slate-300" />
            <h4 className="font-bold text-slate-700">Nenhum atendimento agendado</h4>
            <p className="text-xs text-slate-400 mt-1">Não há compromissos para a data e filtros selecionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Gorgeous Interactive Month Calendar Grid
interface AgendaCalendarProps {
  currentDate: string;
  onDateChange: (dateStr: string) => void;
  appointments: Appointment[];
}

export function AgendaCalendar({ currentDate, onDateChange, appointments }: AgendaCalendarProps) {
  const dateObj = new Date(currentDate + 'T00:00:00');
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'DE ABRIL', 
    'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 
    'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];

  const daysWeek = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Appointments on each day of the current month
  const getDayAppointments = (day: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    return appointments.filter(a => a.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    onDateChange(`${year}-${formattedMonth}-${formattedDay}`);
  };

  const cells = [];
  // Empty slots before first day
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(<div key={`empty-${i}`} className="h-20 bg-slate-50/50 border border-slate-100 rounded-2xl" />);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayApts = getDayAppointments(day);
    const isSelected = dateObj.getDate() === day;
    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

    cells.push(
      <div 
        key={`day-${day}`}
        onClick={() => handleDayClick(day)}
        className={`h-20 md:h-24 p-2 bg-white border border-slate-200 rounded-2xl cursor-pointer transition-all hover:border-blue-500 hover:shadow-sm flex flex-col justify-between ${
          isSelected ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/20' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`w-6 h-6 flex items-center justify-center text-xs font-black rounded-lg ${
            isToday ? 'bg-blue-600 text-white shadow-sm' : 
            isSelected ? 'text-blue-700 font-black' : 'text-slate-700'
          }`}>
            {day}
          </span>
          {dayApts.length > 0 && (
            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
              {dayApts.length} {dayApts.length === 1 ? 'cons.' : 'cons.'}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 overflow-hidden">
          {dayApts.slice(0, 2).map((apt, idx) => (
            <div 
              key={idx} 
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase truncate tracking-tight ${
                apt.status === 'atendido' ? 'bg-green-50 text-green-700 border-none' :
                apt.status === 'em_atendimento' ? 'bg-emerald-50 text-emerald-700 animate-pulse' :
                apt.status === 'paciente_no_local' ? 'bg-blue-50 text-blue-700' :
                apt.status === 'desmarcado' ? 'bg-rose-50 text-rose-500 line-through' :
                'bg-slate-100 text-slate-600'
              }`}
            >
              {apt.timeStart} {apt.patientName.split(' ')[0]}
            </div>
          ))}
          {dayApts.length > 2 && (
            <div className="text-[8px] text-slate-400 font-bold italic pl-1">
              + {dayApts.length - 2} outros
            </div>
          )}
        </div>
      </div>
    );
  }

  const handlePrevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    const formattedMonth = String(newMonth + 1).padStart(2, '0');
    onDateChange(`${newYear}-${formattedMonth}-01`);
  };

  const handleNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    const formattedMonth = String(newMonth + 1).padStart(2, '0');
    onDateChange(`${newYear}-${formattedMonth}-01`);
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50 flex flex-col space-y-6">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
          <CalendarIcon size={18} className="text-blue-500" />
          CALENDÁRIO MENSAL — {monthNames[month]} DE {year}
        </h3>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-4 text-center">
          {daysWeek.map((day, index) => (
            <span key={index} className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
              {day}
            </span>
          ))}
        </div>

        {/* Cells grid */}
        <div className="grid grid-cols-7 gap-2">
          {cells}
        </div>
      </div>
    </div>
  );
}
