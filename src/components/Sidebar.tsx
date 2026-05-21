/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  BarChart3, 
  Calendar, 
  ClipboardList, 
  DollarSign, 
  FileText, 
  HelpCircle, 
  LayoutDashboard, 
  Link, 
  Megaphone, 
  MonitorPlay, 
  Package, 
  Plus, 
  Stethoscope, 
  MessageSquareText,
  UserPlus, 
  UsersRound,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';
import { ViewType } from '../App';

const navItems: { icon: any, label: string, view: ViewType }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'Dashboard' },
  { icon: MessageSquareText, label: 'Assistente IA', view: 'Mensagens' },
  { icon: Calendar, label: 'Agenda', view: 'Agenda' },
  { icon: ClipboardList, label: 'Prontuários', view: 'Prontuários' },
  { icon: Users, label: 'Pacientes', view: 'Pacientes' },
  { icon: MonitorPlay, label: 'Consulta Interativa', view: 'Dashboard' },
  { icon: Megaphone, label: 'Marketing', view: 'Dashboard' },
  { icon: DollarSign, label: 'Financeiro', view: 'Financeiro' },
  { icon: FileText, label: 'TISS', view: 'Dashboard' },
  { icon: Package, label: 'Estoques', view: 'Dashboard' },
  { icon: BarChart3, label: 'Relatórios', view: 'Dashboard' },
  { icon: UsersRound, label: 'Indique e ganhe', view: 'Dashboard' },
  { icon: Link, label: 'Referências', view: 'Dashboard' },
  { icon: HelpCircle, label: 'Ajuda', view: 'Dashboard' },
];

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside id="sidebar" className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={() => onViewChange('Dashboard')}>
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <Stethoscope className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold text-blue-900 tracking-tight">Consultio Med</span>
      </div>

      <div className="px-4 mb-6">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full py-3 px-6 flex items-center justify-center gap-2 font-semibold shadow-md transition-all active:scale-95">
          <Plus size={20} />
          <span>Novo atendimento</span>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 pb-10">
        {navItems.map((item) => (
          <motion.button
            key={item.label}
            onClick={() => onViewChange(item.view)}
            whileHover={{ x: 4 }}
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-colors ${
              activeView === item.view 
                ? 'text-blue-700 bg-blue-50 font-bold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <item.icon size={20} className={activeView === item.view ? 'text-blue-600' : 'text-slate-400'} />
            <span className="text-sm font-medium">{item.label}</span>
          </motion.button>
        ))}
      </nav>
    </aside>
  );
}
