import { Sparkles, Bell, LogOut, ChevronDown, Plus, Menu } from 'lucide-react';
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
    
    return `${daysWeek[dateObj.getDay()]}, ${dateObj.getDate()} de ${months[dateObj.getMonth()]}`;
  };

  return (
    <header className="h-14 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-8 shrink-0 shadow-sm z-20">
      <div className="flex items-center gap-2 lg:gap-6 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
          title="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm lg:text-xl font-black text-slate-900 uppercase tracking-tight truncate">{activeView}</h1>
          <p className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-widest">{formatHeaderDate(currentDate)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 lg:gap-4 shrink-0">
        <button className="hidden lg:flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full font-bold text-xs shadow-sm hover:shadow-md hover:bg-teal-700 transition-all group">
          <Sparkles size={16} className="text-teal-100 group-hover:rotate-12 transition-transform" />
          <span>Ouvir agenda do dia</span>
        </button>

        <button 
          onClick={onNewAppointment}
          className="lg:hidden flex items-center justify-center w-9 h-9 bg-teal-600 text-white rounded-full shadow-sm"
        >
          <Plus size={18} />
        </button>

        <div className="flex items-center gap-1 lg:gap-3 ml-1 lg:ml-3 border-l pl-2 lg:pl-4 border-slate-100">
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 lg:px-3 py-1 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors group">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
              {currentUser.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-slate-900 hidden lg:block">{currentUser.name}</span>
            <ChevronDown size={14} className="text-slate-400 hidden lg:block" />
          </div>

          <div className="flex items-center gap-0 lg:gap-1">
            <button className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all">
              <Bell size={18} className="lg:size-5" />
            </button>
            <button 
              onClick={onLogout}
              title="Sair"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
            >
              <LogOut size={18} className="lg:size-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
