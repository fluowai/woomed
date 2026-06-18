import { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { showToast } from './Toast';
import {
  CrmLead, CrmPipeline, CrmOpportunity, CrmTask, CrmInteraction, LeadSource, LeadSourceChannel,
  LeadStatus, LeadRating
} from '../types';
import {
  Users, TrendingUp, ListTodo, BarChart3, Plus, Search, Phone, Mail, MessageSquare,
  Tag, User, Star, X, ChevronRight, Filter, Target, DollarSign, Calendar, Clock,
  CheckCircle2, AlertCircle, ArrowRight, UserPlus, Building2, Hash, Sparkles
} from 'lucide-react';

interface CrmModuleProps {
  token: string | null;
  userRole: string;
}

const sourceIcons: Record<string, any> = {
  whatsapp: MessageSquare, instagram: Hash, facebook: Hash, site: Building2,
  google_ads: Target, meta_ads: Target, indicacao: UserPlus, email: Mail,
  telefone: Phone, presencial: User, outro: Sparkles
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', contacted: 'bg-amber-100 text-amber-700',
  qualified: 'bg-purple-100 text-purple-700', proposal: 'bg-indigo-100 text-indigo-700',
  negotiation: 'bg-orange-100 text-orange-700', won: 'bg-green-100 text-green-700',
  lost: 'bg-rose-100 text-rose-700'
};

const ratingColors: Record<string, string> = {
  quente: 'bg-red-100 text-red-700', morno: 'bg-amber-100 text-amber-700',
  frio: 'bg-blue-100 text-blue-700'
};

function Shell({ title, subtitle, icon, children, aside }: { title: string; subtitle: string; icon: any; children: any; aside?: any }) {
  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">{icon}</div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
            <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Pill({ label, color }: { label: string; color?: string }) {
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${color || 'bg-slate-100 text-slate-600'}`}>{label}</span>;
}

function Modal({ onClose, children }: { onClose: () => void; children: any }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function CrmModule({ token, userRole }: CrmModuleProps) {
  const [activeTab, setActiveTab] = useState<'kanban' | 'leads' | 'tasks' | 'analytics'>('kanban');
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', source: '', rating: '', search: '' });
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [leadsData, pipelinesData, oppsData, tasksData, sourcesData] = await Promise.all([
        apiGet<CrmLead[]>('/api/crm/leads', token),
        apiGet<CrmPipeline[]>('/api/crm/pipelines', token),
        apiGet<CrmOpportunity[]>('/api/crm/opportunities', token),
        apiGet<CrmTask[]>('/api/crm/tasks', token),
        apiGet<LeadSource[]>('/api/crm/lead-sources', token)
      ]);
      setLeads(leadsData);
      setPipelines(pipelinesData);
      setOpportunities(oppsData);
      setTasks(tasksData);
      setSources(sourcesData);
      if (pipelinesData.length > 0 && !selectedPipeline) setSelectedPipeline(pipelinesData[0].id);
    } catch (e: any) {
      showToast('error', 'Erro ao carregar dados do CRM.');
    }
    setIsLoading(false);
  };

  const filteredLeads = useMemo(() => {
    let l = [...leads];
    if (filter.status) l = l.filter(x => x.status === filter.status);
    if (filter.source) l = l.filter(x => x.source === filter.source);
    if (filter.rating) l = l.filter(x => x.rating === filter.rating);
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      l = l.filter(x => x.fullName.toLowerCase().includes(s) || x.phone.includes(s));
    }
    return l;
  }, [leads, filter]);

  const kanbanColumns = useMemo(() => {
    const pipeline = pipelines.find(p => p.id === selectedPipeline);
    const stages = pipeline?.stages?.length ? pipeline.stages : [
      { name: 'Novo', order: 0, probability: 10 },
      { name: 'Contatado', order: 1, probability: 20 },
      { name: 'Qualificado', order: 2, probability: 40 },
      { name: 'Proposta', order: 3, probability: 60 },
      { name: 'Negociação', order: 4, probability: 80 },
      { name: 'Fechado', order: 5, probability: 100 },
    ];
    const statusMap: Record<string, string> = { 'new': 'Novo', 'contacted': 'Contatado', 'qualified': 'Qualificado', 'proposal': 'Proposta', 'negotiation': 'Negociação', 'won': 'Fechado', 'lost': 'Perdido' };
    return stages.map(stage => {
      const statusKey = Object.entries(statusMap).find(([k, v]) => v === stage.name)?.[0] || '';
      const items = statusKey ? leads.filter(l => l.status === statusKey) : [];
      const totalValue = items.reduce((s, l) => s + (l.estimatedValue || 0), 0);
      return { ...stage, items, totalValue, statusKey };
    });
  }, [leads, selectedPipeline, pipelines]);

  const pipelineValue = useMemo(() => leads.reduce((s, l) => s + (l.lostReason ? 0 : (l.estimatedValue || 0)), 0), [leads]);
  const conversionRate = useMemo(() => {
    const total = leads.length;
    const won = leads.filter(l => l.status === 'won').length;
    return total > 0 ? Math.round((won / total) * 100) : 0;
  }, [leads]);

  const filterSearch = filter.search || '';

  const tabs = [
    { id: 'kanban', label: 'Kanban', icon: TrendingUp },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'tasks', label: 'Tarefas', icon: ListTodo },
    { id: 'analytics', label: 'Análise', icon: BarChart3 },
  ] as const;

  return (
    <Shell
      title="CRM 360"
      subtitle="Gestão de leads, pipeline e oportunidades"
      icon={<TrendingUp size={24} />}
      aside={
        <div className="flex gap-2">
          <button onClick={() => setShowLeadModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all">
            <Plus size={18} /> Novo Lead
          </button>
          <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">
            <ListTodo size={18} /> Nova Tarefa
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Leads</p>
          <p className="text-3xl font-black text-slate-900">{leads.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pipeline</p>
          <p className="text-3xl font-black text-emerald-600">R$ {pipelineValue.toFixed(0)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Taxa Conv.</p>
          <p className="text-3xl font-black text-blue-600">{conversionRate}%</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tarefas</p>
          <p className="text-3xl font-black text-slate-900">{tasks.filter(t => t.status !== 'completed').length}</p>
        </div>
      </div>

      {/* KANBAN VIEW */}
      {activeTab === 'kanban' && (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {pipelines.map(p => (
              <button key={p.id} onClick={() => setSelectedPipeline(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedPipeline === p.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto">
            {kanbanColumns.map(col => (
              <div key={col.name} className="bg-slate-100 rounded-2xl p-4 min-w-[220px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{col.name}</h3>
                  <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full text-slate-600">{col.items.length}</span>
                </div>
                {col.totalValue > 0 && <p className="text-[10px] font-bold text-emerald-600 mb-3">R$ {col.totalValue.toFixed(0)}</p>}
                <div className="space-y-2">
                  {col.items.map(lead => (
                    <div key={lead.id} className="bg-white p-3 rounded-xl border border-slate-200 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-800 truncate">{lead.fullName}</span>
                        <Pill label={lead.rating} color={ratingColors[lead.rating]} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2">
                        {(() => { const Icon = sourceIcons[lead.source] || Sparkles; return <Icon size={12} />; })()}
                        <span>{lead.phone}</span>
                      </div>
                      {lead.estimatedValue > 0 && <p className="text-xs font-bold text-emerald-600">R$ {lead.estimatedValue.toFixed(2)}</p>}
                    </div>
                  ))}
                  {col.items.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4 italic">Nenhum lead</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* LEADS LIST VIEW */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Buscar leads..." value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
              <option value="">Status</option>
              <option value="new">Novo</option><option value="contacted">Contatado</option>
              <option value="qualified">Qualificado</option><option value="proposal">Proposta</option>
              <option value="negotiation">Negociação</option><option value="won">Ganho</option><option value="lost">Perdido</option>
            </select>
            <select value={filter.rating} onChange={e => setFilter({...filter, rating: e.target.value})}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
              <option value="">Temperatura</option>
              <option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option>
            </select>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredLeads.map(lead => (
              <div key={lead.id} className="p-4 hover:bg-slate-50 transition-all flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{lead.fullName}</span>
                    <Pill label={lead.rating} color={ratingColors[lead.rating]} />
                    <Pill label={lead.status} color={statusColors[lead.status]} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Phone size={12} />{lead.phone}</span>
                    {lead.email && <span className="flex items-center gap-1"><Mail size={12} />{lead.email}</span>}
                    <span className="flex items-center gap-1">{(() => { const Icon = sourceIcons[lead.source] || Sparkles; return <Icon size={12} />; })()}{lead.source}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lead.estimatedValue > 0 && <span className="font-bold text-emerald-600 text-sm">R$ {lead.estimatedValue.toFixed(2)}</span>}
                  {!lead.convertedToPatientId && lead.status !== 'lost' && lead.status !== 'won' && (
                    <button onClick={() => setShowConvertModal(lead.id)} className="px-3 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-bold hover:bg-green-100 transition-all">
                      Converter
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredLeads.length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhum lead encontrado.</p>}
          </div>
        </div>
      )}

      {/* TASKS VIEW */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
          {tasks.filter(t => t.status !== 'completed').map(task => (
            <div key={task.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
              <button onClick={async () => {
                await apiPatch(`/api/crm/tasks/${task.id}`, token, { status: 'completed' });
                fetchAll(); showToast('success', 'Tarefa concluída!');
              }} className="w-6 h-6 border-2 border-slate-300 rounded-full hover:border-green-500 hover:bg-green-50 transition-all flex items-center justify-center">
                {task.status === 'completed' && <CheckCircle2 size={16} className="text-green-500" />}
              </button>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">{task.title}</p>
                {task.description && <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <Pill label={task.priority} color={task.priority === 'urgent' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'} />
                  {task.dueDate && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar size={10} />{task.dueDate}</span>}
                </div>
              </div>
            </div>
          ))}
          {tasks.filter(t => t.status !== 'completed').length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhuma tarefa pendente.</p>}
        </div>
      )}

      {/* ANALYTICS VIEW */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Leads por Fonte</h3>
            <div className="space-y-3">
              {(() => {
                const sourceCounts = leads.reduce((acc: Record<string, number>, l) => {
                  acc[l.source] = (acc[l.source] || 0) + 1; return acc;
                }, {} as Record<string, number>);
                const entries = Object.entries(sourceCounts) as [string, number][];
                return entries.sort((a, b) => b[1] - a[1]).map(([source, count]) => {
                  const total = leads.length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 w-24">{source}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 w-12 text-right">{pct}%</span>
                      <span className="text-xs font-bold text-slate-800 w-8 text-right">{count}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Funil de Conversão</h3>
            <div className="space-y-4">
              {kanbanColumns.filter(c => c.statusKey !== 'lost').map(col => {
                const totalInPipeline = leads.length;
                const pct = totalInPipeline > 0 ? Math.round((col.items.length / totalInPipeline) * 100) : 0;
                return (
                  <div key={col.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 w-24">{col.name}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-xl overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl transition-all flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${Math.max(pct, 2)}%` }}>
                        {pct > 10 ? `${pct}%` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-8 text-right">{col.items.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {showLeadModal && (
        <Modal onClose={() => setShowLeadModal(false)}>
          <LeadForm token={token} sources={sources} onSave={() => { setShowLeadModal(false); fetchAll(); }} />
        </Modal>
      )}

      {/* New Task Modal */}
      {showTaskModal && (
        <Modal onClose={() => setShowTaskModal(false)}>
          <TaskForm token={token} leads={leads} onSave={() => { setShowTaskModal(false); fetchAll(); }} />
        </Modal>
      )}

      {/* Convert Modal */}
      {showConvertModal && (
        <Modal onClose={() => setShowConvertModal(null)}>
          <div className="p-8">
            <h3 className="text-lg font-black text-slate-800 mb-4">Converter Lead em Paciente</h3>
            <p className="text-sm text-slate-500 mb-6">O lead será convertido em paciente e um prontuário será criado automaticamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConvertModal(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600">Cancelar</button>
              <button onClick={async () => {
                try {
                  await apiPost(`/api/crm/leads/${showConvertModal}/convert`, token);
                  showToast('success', 'Lead convertido em paciente com sucesso!');
                  setShowConvertModal(null);
                  fetchAll();
                } catch (e: any) {
                  showToast('error', e.message);
                }
              }} className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-bold text-sm">Confirmar Conversão</button>
            </div>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

function LeadForm({ token, sources, onSave }: { token: string | null; sources: LeadSource[]; onSave: () => void }) {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', source: 'outro' as LeadSourceChannel, rating: 'morno' as LeadRating, notes: '', estimatedValue: 0, tags: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.fullName || !form.phone) return showToast('error', 'Nome e telefone obrigatórios.');
    setIsSaving(true);
    try {
      await apiPost('/api/crm/leads', token, { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), estimatedValue: Number(form.estimatedValue) });
      showToast('success', 'Lead cadastrado com sucesso!');
      onSave();
    } catch (e: any) { showToast('error', e.message); }
    setIsSaving(false);
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100";
  const labelClass = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1";

  return (
    <div className="p-8">
      <h3 className="text-lg font-black text-slate-800 mb-6">Novo Lead</h3>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nome completo *</label>
          <input className={inputClass} value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="Nome do lead" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone *</label>
            <input className={inputClass} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(48) 99999-0000" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemplo.com" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fonte</label>
            <select className={inputClass} value={form.source} onChange={e => setForm({...form, source: e.target.value as LeadSourceChannel})}>
              <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option><option value="site">Site</option>
              <option value="google_ads">Google Ads</option><option value="meta_ads">Meta Ads</option>
              <option value="indicacao">Indicação</option><option value="email">E-mail</option>
              <option value="telefone">Telefone</option><option value="presencial">Presencial</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Temperatura</label>
            <select className={inputClass} value={form.rating} onChange={e => setForm({...form, rating: e.target.value as LeadRating})}>
              <option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Valor Estimado (R$)</label>
          <input className={inputClass} type="number" value={form.estimatedValue} onChange={e => setForm({...form, estimatedValue: Number(e.target.value)})} />
        </div>
        <div>
          <label className={labelClass}>Tags (separadas por vírgula)</label>
          <input className={inputClass} value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="urgente, vip, retorno" />
        </div>
        <div>
          <label className={labelClass}>Observações</label>
          <textarea className={`${inputClass} h-20 resize-none`} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600">Cancelar</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50">
          {isSaving ? 'Salvando...' : 'Salvar Lead'}
        </button>
      </div>
    </div>
  );
}

function TaskForm({ token, leads, onSave }: { token: string | null; leads: CrmLead[]; onSave: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium', leadId: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title) return showToast('error', 'Título obrigatório.');
    setIsSaving(true);
    try {
      await apiPost('/api/crm/tasks', token, form);
      showToast('success', 'Tarefa criada!');
      onSave();
    } catch (e: any) { showToast('error', e.message); }
    setIsSaving(false);
  };

  return (
    <div className="p-8">
      <h3 className="text-lg font-black text-slate-800 mb-6">Nova Tarefa</h3>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Título *</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ex: Ligar para lead" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lead relacionado</label>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value={form.leadId} onChange={e => setForm({...form, leadId: e.target.value})}>
            <option value="">Nenhum</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.fullName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prioridade</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option value="low">Baixa</option><option value="medium">Média</option>
              <option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vencimento</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none h-20 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600">Cancelar</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50">
          {isSaving ? 'Salvando...' : 'Salvar Tarefa'}
        </button>
      </div>
    </div>
  );
}
