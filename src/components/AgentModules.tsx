import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '../api';
import {
  Activity, ArrowRight, BarChart3, Bot, Calendar, Check, ChevronDown, ChevronRight,
  Clock, Ear, Filter, Loader2, MessageSquare, Phone, RefreshCw, Search, Send,
  TrendingUp, TrendingDown, User, UserCheck, Users, X, AlertCircle, Flag,
  ArrowUpDown, MessageSquareText, ListTodo, PieChart, Zap, AlertTriangle,
  CheckCircle2, LogOut, Timer,
} from 'lucide-react';

const token = () => localStorage.getItem('consultio_token');

interface LeadView {
  id: string; name: string; phone: string; need: string; urgency: string;
  stage: string; source: string; assignedAgentId: string; sessionId: string;
  lastContactAt: string; createdAt: string; notes: string;
}

interface SessionView {
  id: string; agentId: string; agentName: string; contactId: string;
  contactName: string; contactPhone: string; channel: string;
  status: string; leadStage: string; urgency: string;
  messageCount: number; lastMessageAt: string; createdAt: string;
}

interface MetricsView {
  agentId: string; agentName: string; totalSessions: number;
  activeSessions: number; resolvedSessions: number; escalatedSessions: number;
  avgResponseTime: number; messagesProcessed: number; actionsExecuted: number;
  successRate: number; leadsCreated: number; appointmentsBooked: number;
}

interface PipelineView {
  stage: string; leads: LeadView[]; count: number;
}

const urgencyColor = (u: string) => {
  switch (u) {
    case 'urgencia': return 'text-red-600 bg-red-50 border-red-200';
    case 'alta': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'media': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default: return 'text-green-600 bg-green-50 border-green-200';
  }
};

const stageColors: Record<string, string> = {
  novo: 'bg-slate-100 text-slate-700',
  contatado: 'bg-blue-50 text-blue-700',
  qualificado: 'bg-purple-50 text-purple-700',
  agendando: 'bg-amber-50 text-amber-700',
  agendado: 'bg-green-50 text-green-700',
  convertido: 'bg-emerald-50 text-emerald-700',
  perdido: 'bg-rose-50 text-rose-700',
};

const stageLabels: Record<string, string> = {
  novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado',
  agendando: 'Agendando', agendado: 'Agendado', convertido: 'Convertido', perdido: 'Perdido',
};

// === Agent Pipeline Dashboard ===
export function AgentPipelineDashboard() {
  const [pipeline, setPipeline] = useState<PipelineView[]>([]);
  const [metrics, setMetrics] = useState<MetricsView[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);
  const [escalatedSessions, setEscalatedSessions] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pipeData, metData] = await Promise.all([
        apiGet<{ pipeline: PipelineView[]; totalLeads: number; activeSessions: number; escalatedSessions: number }>('/api/v2/agents/pipeline', token()),
        apiGet<{ metrics: MetricsView[] }>('/api/v2/agents/metrics', token()),
      ]);
      setPipeline(pipeData.pipeline);
      setTotalLeads(pipeData.totalLeads);
      setActiveSessions(pipeData.activeSessions);
      setEscalatedSessions(pipeData.escalatedSessions);
      setMetrics(metData.metrics);
    } catch (e) { console.error('Pipeline load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  const leadStages = ['novo', 'contatado', 'qualificado', 'agendando', 'agendado', 'convertido', 'perdido'];
  const totalAgents = metrics.length;
  const totalLeadsFromMetrics = metrics.reduce((a, m) => a + m.leadsCreated, 0);
  const totalAppointmentsFromMetrics = metrics.reduce((a, m) => a + m.appointmentsBooked, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Pipeline de Agentes</h2>
            <p className="text-sm text-slate-500">Visão geral do funil de vendas e desempenho dos agentes</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-blue-50 rounded-xl"><Users className="w-5 h-5 text-blue-600" /></div>
              <span className="text-sm font-medium text-slate-500">Total Leads</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{totalLeads}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-green-50 rounded-xl"><MessageSquareText className="w-5 h-5 text-green-600" /></div>
              <span className="text-sm font-medium text-slate-500">Sessoes Ativas</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{activeSessions}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-amber-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <span className="text-sm font-medium text-slate-500">Escalados</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{escalatedSessions}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-purple-50 rounded-xl"><Bot className="w-5 h-5 text-purple-600" /></div>
              <span className="text-sm font-medium text-slate-500">Agentes</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{totalAgents}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-emerald-50 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
              <span className="text-sm font-medium text-slate-500">Conversao</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{totalLeadsFromMetrics > 0 ? ((totalAppointmentsFromMetrics / totalLeadsFromMetrics) * 100).toFixed(0) : 0}%</p>
            <p className="text-[10px] text-slate-400 mt-1">{totalAppointmentsFromMetrics} consultas / {totalLeadsFromMetrics} leads</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Funil de Leads</h3>
          <div className="flex items-end gap-2 h-48">
            {leadStages.map(stage => {
              const pipe = pipeline.find(p => p.stage === stage);
              const count = pipe?.count || 0;
              const maxCount = Math.max(...pipeline.map(p => p.count), 1);
              const height = (count / maxCount) * 100;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">{count}</span>
                  <div className="w-full rounded-lg transition-all duration-500" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: stage === 'perdido' ? '#f1f5f9' : '#3b82f6' }} />
                  <span className="text-xs font-medium text-slate-500 text-center">{stageLabels[stage]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Desempenho dos Agentes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-3 font-semibold text-slate-500">Agente</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-500">Sessoes</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-500">Ativas</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-500">Taxa Sucesso</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-500">Acoes</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-500">Leads</th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-500">Consultas</th>
                  <th className="text-right py-3 px-3 font-semibold text-slate-500">Tempo Medio</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(m => (
                  <tr key={m.agentId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-800">{m.agentName}</td>
                    <td className="text-center py-3 px-3 text-slate-600">{m.totalSessions}</td>
                    <td className="text-center py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{m.activeSessions}</span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-xs font-bold ${m.successRate >= 70 ? 'text-green-600' : m.successRate >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{m.successRate.toFixed(0)}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.successRate >= 70 ? 'bg-green-500' : m.successRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${m.successRate}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-3 text-slate-600">{m.actionsExecuted}</td>
                    <td className="text-center py-3 px-3 text-slate-600">{m.leadsCreated}</td>
                    <td className="text-center py-3 px-3 text-slate-600">{m.appointmentsBooked}</td>
                    <td className="text-right py-3 px-3 text-slate-500 text-xs">{(m.avgResponseTime / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// === SDR Pipeline View (Kanban) ===
export function SdrPipeline() {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgency, setFilterUrgency] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<LeadView | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ leads: LeadView[] }>('/api/v2/agents/leads', token());
      setLeads(data.leads);
    } catch (e) { console.error('Leads load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stages = ['novo', 'contatado', 'qualificado', 'agendando', 'agendado', 'convertido', 'perdido'];

  const filteredLeads = leads.filter(l => !filterUrgency || l.urgency === filterUrgency);

  const handleAdvanceStage = async (leadId: string, currentStage: string) => {
    const idx = stages.indexOf(currentStage);
    if (idx < 0 || idx >= stages.length - 1) return;
    const nextStage = stages[idx + 1];
    try {
      await apiPatch(`/api/v2/agents/leads/${leadId}`, token(), { stage: nextStage });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: nextStage } : l));
    } catch (e) { console.error('Stage update error:', e); }
  };

  const handleUpdateNotes = async () => {
    if (!selectedLead) return;
    try {
      await apiPatch(`/api/v2/agents/leads/${selectedLead.id}`, token(), { notes: editNotes });
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, notes: editNotes } : l));
      setSelectedLead(null);
    } catch (e) { console.error('Notes update error:', e); }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Pipeline SDR</h2>
            <p className="text-sm text-slate-500">Acompanhe leads em cada estagio do funil</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">Todas urgencias</option>
              <option value="baixa">Baixa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgencia">Urgencia</option>
            </select>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {stages.map(stage => {
            const stageLeads = filteredLeads.filter(l => l.stage === stage);
            return (
              <div key={stage} className="flex-shrink-0 w-64 bg-slate-100/80 rounded-2xl border border-slate-200">
                <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage === 'perdido' ? 'bg-rose-400' : 'bg-blue-500'}`} />
                    <span className="font-bold text-sm text-slate-700">{stageLabels[stage]}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                </div>
                <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                  {stageLeads.map(lead => (
                    <div key={lead.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => { setSelectedLead(lead); setEditNotes(lead.notes || ''); }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-slate-800 truncate">{lead.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${urgencyColor(lead.urgency)}`}>{lead.urgency}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mb-2">{lead.need || 'Sem necessidade'}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{lead.phone}</span>
                        <button onClick={e => { e.stopPropagation(); handleAdvanceStage(lead.id, stage); }}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${stage === 'perdido' ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                          disabled={stage === 'perdido'}>
                          Avancar <ArrowRight size={10} className="inline" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400">Nenhum lead</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{selectedLead.name}</h3>
              <button onClick={() => setSelectedLead(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Telefone</span><span className="font-medium">{selectedLead.phone}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Necessidade</span><span className="font-medium">{selectedLead.need || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Urgencia</span><span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urgencyColor(selectedLead.urgency)}`}>{selectedLead.urgency}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estagio</span><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stageColors[selectedLead.stage]}`}>{stageLabels[selectedLead.stage]}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fonte</span><span className="font-medium">{selectedLead.source}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Criado em</span><span className="font-medium">{new Date(selectedLead.createdAt).toLocaleDateString()}</span></div>
              <div>
                <label className="block text-slate-500 mb-1">Observacoes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" rows={3} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleUpdateNotes} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">Salvar</button>
              <button onClick={() => setSelectedLead(null)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Agent Conversation Log ===
export function AgentConversations() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessData, logsData] = await Promise.all([
        apiGet<{ sessions: SessionView[] }>('/api/v2/agents/sessions', token()),
        apiGet<{ logs: any[] }>('/api/v2/agents/logs', token()),
      ]);
      setSessions(sessData.sessions);
      setLogs(logsData.logs);
    } catch (e) { console.error('Sessions load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredSessions = sessions.filter(s =>
    !search || s.contactName.toLowerCase().includes(search.toLowerCase()) || s.contactPhone.includes(search)
  );

  const sessionLogs = selectedSession ? logs.filter(l => l.sessionId === selectedSession) : [];

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50">
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.map(s => (
            <div key={s.id} onClick={() => setSelectedSession(s.id)}
              className={`p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${selectedSession === s.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-slate-800">{s.contactName}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stageColors[s.leadStage]}`}>{stageLabels[s.leadStage]}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{s.contactPhone} &middot; {s.channel}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400">{s.messageCount} msgs</span>
                <span className={`text-[10px] font-medium ${s.status === 'active' ? 'text-green-600' : s.status === 'waiting_human' ? 'text-amber-600' : 'text-slate-400'}`}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSession ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">
                  {sessions.find(s => s.id === selectedSession)?.contactName || 'Conversa'}
                </h3>
                <p className="text-xs text-slate-500">
                  {sessions.find(s => s.id === selectedSession)?.contactPhone}
                </p>
              </div>
              <button onClick={load} className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                <RefreshCw size={12} /> Recarregar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sessionLogs.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Nenhum log de execucao para esta sessao</p>
                </div>
              )}
              {sessionLogs.map(log => (
                <div key={log.id} className={`p-3 rounded-2xl border max-w-[80%] ${log.success ? 'bg-white border-slate-200 ml-auto' : 'bg-rose-50 border-rose-200 ml-auto'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{log.action}</span>
                    {log.success ? <CheckCircle2 size={12} className="text-green-500" /> : <X size={12} className="text-rose-500" />}
                    <span className="text-[10px] text-slate-400 ml-auto">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-slate-700 mb-1"><span className="text-slate-400">Prompt:</span> {log.prompt?.slice(0, 200)}</p>
                  <p className="text-xs text-slate-700"><span className="text-slate-400">Resposta:</span> {log.response?.slice(0, 300)}</p>
                  {log.error && <p className="text-xs text-rose-500 mt-1">Erro: {log.error}</p>}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                    <span>{log.modelUsed}</span>
                    <span>{(log.latencyMs / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquareText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-600">Selecione uma conversa</h3>
              <p className="text-sm text-slate-400">Escolha uma conversa a esquerda para ver os logs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// === Follow-up Management ===
export function FollowUpManagement() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ entries: any[]; count: number }>('/api/v2/followup/queue', token());
      setEntries(data.entries);
    } catch (e) { console.error('FollowUp load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUnregister = async (sessionId: string) => {
    try {
      await apiPost(`/api/v2/followup/unregister/${sessionId}`, token());
      setEntries(prev => prev.filter(e => e.sessionId !== sessionId));
    } catch (e) { console.error('Unregister error:', e); }
  };

  const handleReschedule = async (sessionId: string, hours: number) => {
    try {
      const nextDate = new Date();
      nextDate.setHours(nextDate.getHours() + hours);
      await apiPatch(`/api/v2/followup/entry/${sessionId}`, token(), {
        nextFollowUpAt: nextDate.toISOString(),
      });
      load();
    } catch (e) { console.error('Reschedule error:', e); }
  };

  const filteredEntries = entries.filter(e => !filterStage || e.stage === filterStage);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Gestao de Follow-ups</h2>
            <p className="text-sm text-slate-500">{entries.length} follow-up(s) agendados</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">Todos os estagios</option>
              <option value="novo">Novo</option>
              <option value="qualificado">Qualificado</option>
              <option value="agendando">Agendando</option>
              <option value="agendado">Agendado</option>
            </select>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium transition-colors">
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Timer className="w-4 h-4 text-blue-500" /><span className="text-xs font-medium text-slate-500">Pendentes</span></div>
            <p className="text-2xl font-bold text-slate-800">{entries.filter(e => new Date(e.nextFollowUpAt) <= new Date()).length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs font-medium text-slate-500">Agendados</span></div>
            <p className="text-2xl font-bold text-slate-800">{entries.filter(e => new Date(e.nextFollowUpAt) > new Date()).length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Send className="w-4 h-4 text-green-500" /><span className="text-xs font-medium text-slate-500">Envios</span></div>
            <p className="text-2xl font-bold text-slate-800">{entries.reduce((a, e) => a + (e.followUpCount || 0), 0)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-500">Contato</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500">Estagio</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-500">Canal</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-500">Envios</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-500">Proximo</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-500">Ultimo Contato</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-500">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => {
                  const isDue = new Date(entry.nextFollowUpAt) <= new Date();
                  return (
                    <tr key={entry.sessionId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{entry.contactName}</div>
                        <div className="text-xs text-slate-400">{entry.contactPhone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stageColors[entry.stage] || 'bg-slate-100 text-slate-700'}`}>
                          {stageLabels[entry.stage] || entry.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{entry.channel}</td>
                      <td className="text-center py-3 px-4">
                        <span className="text-xs font-bold text-slate-700">{entry.followUpCount}x</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`text-xs font-medium ${isDue ? 'text-rose-600' : 'text-slate-600'}`}>
                          {isDue ? 'VENcido' : new Date(entry.nextFollowUpAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-xs text-slate-500">
                        {new Date(entry.lastContactAt).toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleReschedule(entry.sessionId, 1)}
                            className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Reagendar +1h">
                            +1h
                          </button>
                          <button onClick={() => handleReschedule(entry.sessionId, 24)}
                            className="text-xs font-medium px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors" title="Reagendar +24h">
                            +24h
                          </button>
                          <button onClick={() => handleUnregister(entry.sessionId)}
                            className="text-xs font-medium px-2 py-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="Remover follow-up">
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Send className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">Nenhum follow-up encontrado</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Agent Metrics ===
export function AgentMetricsView() {
  const [metrics, setMetrics] = useState<MetricsView[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionView[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metData, sessData] = await Promise.all([
        apiGet<{ metrics: MetricsView[] }>('/api/v2/agents/metrics', token()),
        apiGet<{ sessions: SessionView[] }>('/api/v2/agents/sessions', token()),
      ]);
      setMetrics(metData.metrics);
      setSessions(sessData.sessions);
    } catch (e) { console.error('Metrics load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  const totalSuccessRate = metrics.length > 0
    ? metrics.reduce((a, m) => a + m.successRate, 0) / metrics.length
    : 0;
  const totalActions = metrics.reduce((a, m) => a + m.actionsExecuted, 0);
  const totalLeads = metrics.reduce((a, m) => a + m.leadsCreated, 0);
  const totalAppointments = metrics.reduce((a, m) => a + m.appointmentsBooked, 0);
  const avgResponse = metrics.length > 0
    ? metrics.reduce((a, m) => a + m.avgResponseTime, 0) / metrics.length
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Metricas dos Agentes</h2>
            <p className="text-sm text-slate-500">Indicadores de desempenho consolidados</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 transition-colors">
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-blue-500" /><span className="text-xs font-medium text-slate-500">Taxa de Sucesso</span></div>
            <p className="text-2xl font-bold text-slate-800">{totalSuccessRate.toFixed(0)}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Zap className="w-4 h-4 text-amber-500" /><span className="text-xs font-medium text-slate-500">Acoes Executadas</span></div>
            <p className="text-2xl font-bold text-slate-800">{totalActions}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><UserCheck className="w-4 h-4 text-green-500" /><span className="text-xs font-medium text-slate-500">Leads Criados</span></div>
            <p className="text-2xl font-bold text-slate-800">{totalLeads}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-purple-500" /><span className="text-xs font-medium text-slate-500">Consultas</span></div>
            <p className="text-2xl font-bold text-slate-800">{totalAppointments}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Timer className="w-4 h-4 text-slate-500" /><span className="text-xs font-medium text-slate-500">Tempo Resposta Medio</span></div>
            <p className="text-2xl font-bold text-slate-800">{(avgResponse / 1000).toFixed(1)}s</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-indigo-500" /><span className="text-xs font-medium text-slate-500">Sessoes Ativas</span></div>
            <p className="text-2xl font-bold text-slate-800">{sessions.filter(s => s.status === 'active').length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><LogOut className="w-4 h-4 text-rose-500" /><span className="text-xs font-medium text-slate-500">Escalados</span></div>
            <p className="text-2xl font-bold text-slate-800">{sessions.filter(s => s.status === 'waiting_human').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Detalhamento por Agente</h3>
          <div className="space-y-4">
            {metrics.map(m => (
              <div key={m.agentId} className="border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{m.agentName}</p>
                      <p className="text-xs text-slate-500">{m.totalSessions} sessoes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Sucesso</p>
                      <p className="font-bold text-lg">{m.successRate.toFixed(0)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Leads</p>
                      <p className="font-bold text-lg">{m.leadsCreated}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Consultas</p>
                      <p className="font-bold text-lg">{m.appointmentsBooked}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-slate-500">Ativas</span>
                    <p className="font-bold text-slate-700">{m.activeSessions}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-slate-500">Resolvidas</span>
                    <p className="font-bold text-slate-700">{m.resolvedSessions}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-slate-500">Escaladas</span>
                    <p className="font-bold text-slate-700">{m.escalatedSessions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
