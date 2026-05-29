/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Bell, MessageSquare, LogOut, ChevronDown, Plus } from 'lucide-react';
import { AppUser } from '../types';

interface HeaderProps {
  onMenuClick?: () => void;
  activeView: string;
  currentDate: string;
  onNewAppointment: () => void;
  currentUser: AppUser;
  onLogout: () => void;
}

export default function Header({ onMenuClick, activeView, currentDate, onNewAppointment, currentUser, onLogout }: HeaderProps) {
  
  const formatHeaderDate = (dateStr: string) => {
    const daysWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 
      'Maio', 'Junho', 'Julho', 'Agosto', 
      'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const dateObj = new Date(dateStr + 'T00:00:00');
    if (isNaN(dateObj.getTime())) return dateStr;
    
    return `${daysWeek[dateObj.getDay()]}, ${dateObj.getDate()} de ${months[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;
  };

  return (
    <header id="main-header" className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-20">
      <div className="flex items-center gap-3 md:gap-6">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <div className="w-6 h-0.5 bg-slate-600 mb-1.5" />
          <div className="w-6 h-0.5 bg-slate-600 mb-1.5" />
          <div className="w-6 h-0.5 bg-slate-600" />
        </button>
        
        <div className="hidden sm:block">
          <h1 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">{activeView}</h1>
          <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">{formatHeaderDate(currentDate)}</p>
        </div>
        
        <button 
          onClick={onNewAppointment}
          className="flex items-center justify-center gap-2 px-3 md:px-5 py-2 text-blue-600 bg-blue-50 border-none rounded-full hover:bg-blue-100 transition-colors font-bold text-[10px] md:text-xs uppercase tracking-wider active:scale-95"
        >
          <Plus size={16} />
          <span className="hidden xs:inline">Agendar</span>
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <button className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-blue-600 text-white rounded-full font-bold text-xs md:text-sm shadow-sm hover:shadow-md hover:bg-blue-700 transition-all group">
          <Sparkles size={16} className="text-blue-100 group-hover:rotate-12 transition-transform" />
          <span className="hidden md:inline">Ouvir agenda do dia</span>
          <span className="md:hidden">Agenda</span>
        </button>

        <div className="flex items-center gap-2 md:gap-4 ml-1 md:ml-2 border-l pl-3 md:pl-6 border-slate-100">
          <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
              {currentUser.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
              <span className="text-[10px] text-slate-500 font-medium group-hover:text-blue-600">{currentUser.specialty || currentUser.role}</span>
            </div>
            <ChevronDown size={14} className="text-slate-400 ml-1" />
          </div>

          <div className="flex items-center gap-1">
            <button className="p-2 md:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
              <Bell size={20} />
            </button>
            <button className="hidden sm:block p-2 md:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
              <MessageSquare size={20} />
            </button>
            <button 
              onClick={onLogout}
              title="Sair"
              className="p-2 md:p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
