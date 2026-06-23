import {
  BarChart3, 
  Bot,
  Calendar, 
  ClipboardList, 
  CreditCard,
  DatabaseZap,
  DollarSign, 
  FileText, 
  HelpCircle, 
  LayoutDashboard, 
  Link, 
  Megaphone, 
  MonitorPlay, 
  Package, 
  Plus, 
  ServerCog,
  Smartphone,
  Stethoscope, 
  MessageSquareText,
  UserPlus, 
  UsersRound,
  Users,
  Activity,
  ListTodo,
  PieChart,
  Building2,
  MoreHorizontal,
  X,
  TrendingUp,
  ThumbsUp,
  Shield,
  Zap,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType } from '../App';
import { useState, useEffect } from 'react';

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'Dashboard' as ViewType },
  { icon: Calendar, label: 'Agenda', view: 'Agenda' as ViewType },
  { icon: Users, label: 'Pacientes', view: 'Pacientes' as ViewType },
  { icon: ClipboardList, label: 'Prontuários', view: 'Prontuários' as ViewType },
  { icon: MessageSquareText, label: 'Mensagens', view: 'Mensagens' as ViewType },
];

function allNavItems(): { icon: any, label: string, view: ViewType, superAdminOnly?: boolean }[] {
  return [
    { icon: LayoutDashboard, label: 'Dashboard', view: 'Dashboard' },
    { icon: Building2, label: 'Painel SaaS', view: 'Painel SaaS', superAdminOnly: true },
    { icon: TrendingUp, label: 'CRM 360', view: 'CRM 360' },
    { icon: MessageSquareText, label: 'Mensagens', view: 'Mensagens' },
  { icon: Smartphone, label: 'Conexoes', view: 'Conexoes' },
  { icon: Bot, label: 'Assistente IA', view: 'Assistente IA' },
  { icon: ServerCog, label: 'LLMs', view: 'LLMs' },
  { icon: Bot, label: 'Central de Agentes', view: 'Central de Agentes' },
  { icon: Activity, label: 'Pipeline', view: 'Pipeline Agentes' },
  { icon: ListTodo, label: 'Pipeline SDR', view: 'Pipeline SDR' },
  { icon: PieChart, label: 'Métricas', view: 'Métricas Agentes' },
  { icon: Send, label: 'Follow-ups', view: 'Follow-ups' },
  { icon: DatabaseZap, label: 'Neural', view: 'Neural' },
  { icon: Calendar, label: 'Agenda', view: 'Agenda' },
  { icon: ClipboardList, label: 'Prontuários', view: 'Prontuários' },
  { icon: Users, label: 'Pacientes', view: 'Pacientes' },
  { icon: MonitorPlay, label: 'Consulta Interativa', view: 'Consulta Interativa' },
  { icon: Megaphone, label: 'Marketing', view: 'Marketing' },
  { icon: DollarSign, label: 'Financeiro', view: 'Financeiro' },
  { icon: FileText, label: 'TISS', view: 'TISS' },
  { icon: Package, label: 'Estoques', view: 'Estoques' },
  { icon: BarChart3, label: 'Relatórios', view: 'Relatórios' },
  { icon: ThumbsUp, label: 'NPS & LGPD', view: 'NPS & LGPD' },
  { icon: Zap, label: 'Automação', view: 'Automação' },
  { icon: UsersRound, label: 'Indique e ganhe', view: 'Indique e ganhe' },
  { icon: Link, label: 'Referências', view: 'Referências' },
  { icon: HelpCircle, label: 'Ajuda', view: 'Ajuda' },
  ];
}

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  onNewAppointment: () => void;
  userRole?: string;
  userTenantId?: string;
  activeSaasSection?: 'overview' | 'tenants' | 'plans' | 'settings';
  onSaasSectionChange?: (section: 'overview' | 'tenants' | 'plans' | 'settings') => void;
}

export default function Sidebar({ activeView, onViewChange, onNewAppointment, userRole, userTenantId, activeSaasSection = 'overview', onSaasSectionChange }: SidebarProps) {
  const isPlatformAdmin = userRole === 'super_admin' && !userTenantId;
  const saasSections = [
    { icon: Activity, label: 'Visao Geral', id: 'overview' as const },
    { icon: Building2, label: 'Clinicas', id: 'tenants' as const },
    { icon: CreditCard, label: 'Planos', id: 'plans' as const },
    { icon: ServerCog, label: 'Configuracoes', id: 'settings' as const },
  ];
  const navItems = isPlatformAdmin
    ? [{ icon: Building2, label: 'Painel SaaS', view: 'Painel SaaS' as ViewType, superAdminOnly: true }]
    : allNavItems().filter(item => !item.superAdminOnly || userRole === 'super_admin');
  const mobileMainNavItems = isPlatformAdmin
    ? [{ icon: Building2, label: 'Painel SaaS', view: 'Painel SaaS' as ViewType }]
    : mainNavItems;
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [pendingFollowUps, setPendingFollowUps] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('consultio_token');
    if (!token) return;
    fetch('/api/v2/followup/queue', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const entries = data.entries || [];
        const due = entries.filter((e: any) => new Date(e.nextFollowUpAt) <= new Date());
        setPendingFollowUps(due.length);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={() => onViewChange(isPlatformAdmin ? 'Painel SaaS' : 'Dashboard')}>
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
            <Stethoscope className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-teal-900 tracking-tight">Consultio Med</span>
        </div>

        {!isPlatformAdmin && (
          <div className="px-4 mb-6">
            <button
              onClick={onNewAppointment}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-full py-3 px-6 flex items-center justify-center gap-2 font-semibold shadow-md transition-all active:scale-95"
            >
              <Plus size={20} />
              <span>Novo atendimento</span>
            </button>
          </div>
        )}

        <nav className="flex-1 px-4 space-y-1 pb-10">
          {navItems.map((item) => (
            <div key={item.label}>
              <motion.button
                onClick={() => onViewChange(item.view)}
                whileHover={{ x: 4 }}
                className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-colors ${
                  activeView === item.view
                    ? 'text-teal-700 bg-teal-50 font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <item.icon size={20} className={activeView === item.view ? 'text-teal-600' : 'text-slate-400'} />
                <span className="text-sm font-medium">{item.label}</span>
                {item.view === 'Follow-ups' && pendingFollowUps > 0 && (
                  <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {pendingFollowUps > 99 ? '99+' : pendingFollowUps}
                  </span>
                )}
              </motion.button>

              {isPlatformAdmin && item.view === 'Painel SaaS' && (
                <div className="mt-2 ml-5 pl-3 border-l border-teal-100 space-y-1">
                  {saasSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSaasSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          onViewChange('Painel SaaS');
                          onSaasSectionChange?.(section.id);
                        }}
                        className={`flex items-center w-full gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-teal-100 text-teal-800'
                            : 'text-teal-700/70 hover:bg-teal-50 hover:text-teal-800'
                        }`}
                      >
                        <Icon size={15} />
                        <span>{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileMainNavItems.map((item) => {
            const isActive = activeView === item.view;
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => onViewChange(item.view)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-colors min-w-0 flex-1 ${
                  isActive ? 'text-teal-600' : 'text-slate-400'
                }`}
              >
                <Icon size={22} className={isActive ? 'text-teal-600' : ''} />
                <span className={`text-[9px] font-bold uppercase tracking-tight ${isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                  {item.label === 'Prontuários' ? 'Pront.' : item.label === 'Mensagens' ? 'Chat' : item.label}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl transition-colors min-w-0 flex-1 ${
              isMoreOpen || (mobileMainNavItems.every(i => i.view !== activeView) && activeView !== '') ? 'text-teal-600' : 'text-slate-400'
            }`}
          >
            <MoreHorizontal size={22} />
            <span className="text-[9px] font-bold uppercase tracking-tight">Mais</span>
          </button>
        </div>
      </nav>

      {/* More Menu Modal (Mobile) */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <div 
              className="lg:hidden fixed inset-0 bg-slate-900/40 z-[60]"
              onClick={() => setIsMoreOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto safe-area-bottom"
            >
              <div className="sticky top-0 bg-white pt-4 pb-2 px-6 border-b border-slate-100 flex items-center justify-between z-10">
                <h3 className="font-bold text-slate-800">Todos os módulos</h3>
                <button 
                  onClick={() => setIsMoreOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 grid grid-cols-4 gap-2">
                {navItems.filter(item => !mobileMainNavItems.some(m => m.view === item.view)).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => {
                        onViewChange(item.view);
                        setIsMoreOpen(false);
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors ${
                        isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={24} />
                      <span className="text-[9px] font-bold text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {userRole !== 'super_admin' && (
                <div className="px-4 pb-6 pt-2">
                  <button
                    onClick={onNewAppointment}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-lg transition-all active:scale-95"
                  >
                    <Plus size={20} />
                    <span>Novo Atendimento</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
