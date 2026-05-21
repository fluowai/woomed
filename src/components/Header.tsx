/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Bell, MessageSquare, Settings, X, ChevronDown, Plus } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header id="main-header" className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
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
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="text-[10px] md:text-xs text-slate-500 font-medium">Quinta-feira, 24 de Agosto de 2025</p>
        </div>
        
        <button className="flex items-center justify-center gap-2 px-3 md:px-5 py-2 text-blue-600 bg-blue-50 border-none rounded-full hover:bg-blue-100 transition-colors font-bold text-[10px] md:text-xs uppercase tracking-wider">
          <Plus size={16} />
          <span className="hidden xs:inline">adicionar</span>
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
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">MT</div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-slate-900">Dr. Matheus</span>
              <span className="text-[10px] text-slate-500 font-medium group-hover:text-blue-600">Cardiologista</span>
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
            <button className="p-2 md:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
