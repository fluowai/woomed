import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { showToast } from './Toast';
import { AutomationTemplate } from '../types';
import { ServerCog, Clock, Send, Plus, Play, RefreshCw, Trash2, Bell, ListTodo, Settings, Zap, Activity } from 'lucide-react';

function Shell({ title, subtitle, icon, children, aside }: { title: string; subtitle: string; icon: any; children: any; aside?: any }) {
  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">{icon}</div>
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

export default function AutomationModule({ token }: { token: string | null }) {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'followup' | 'templates'>('scheduler');

  const tabs = [
    { id: 'scheduler', label: 'Agendador', icon: ServerCog },
    { id: 'followup', label: 'Follow-ups', icon: Bell },
    { id: 'templates', label: 'Modelos', icon: ListTodo },
  ] as const;

  return (
    <Shell title="Automação" subtitle="Agendamento de tarefas, follow-ups e lembretes automáticos" icon={<Zap size={24} />}>
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${isActive ? 'bg-teal-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'scheduler' && <SchedulerPanel token={token} />}
      {activeTab === 'followup' && <FollowUpPanel token={token} />}
      {activeTab === 'templates' && <TemplatesPanel token={token} />}
    </Shell>
  );
}

function SchedulerPanel({ token }: { token: string | null }) {
  const [status, setStatus] = useState<{ running: boolean; taskCount: number; lastTick: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    if (!token) return;
    try {
      const data = await apiGet<{ running: boolean; taskCount: number; lastTick: string }>('/api/v2/scheduler/status', token);
      setStatus(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadStatus() }, [token]);

  const handleTick = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiPost('/api/v2/scheduler/tick', token, {});
      showToast('success', 'Tick manual executado');
      loadStatus();
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao executar tick');
    }
    setLoading(false);
  };

  const handleRestart = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiPost('/api/v2/scheduler/restart', token, {});
      showToast('success', 'Scheduler reiniciado');
      loadStatus();
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao reiniciar');
    }
    setLoading(false);
  };

  const handleGenerateReminders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiPost('/api/v2/scheduler/reminders/generate', token, {});
      showToast('success', 'Lembretes gerados a partir dos modelos');
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao gerar lembretes');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
        <h3 className="font-black text-slate-900 mb-5 flex items-center gap-2"><Activity size={18} className="text-teal-500" /> Status do Agendador</h3>
        {status ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${status.running ? 'bg-emerald-500' : 'bg-red-400'}`} />
                <span className="font-bold text-slate-800">{status.running ? 'Rodando' : 'Parado'}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarefas</p>
              <p className="font-bold text-slate-800">{status.taskCount} pendentes</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Último Tick</p>
              <p className="font-bold text-slate-800 text-sm">{new Date(status.lastTick).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 font-bold mb-6">Carregando...</div>
        )}

        <div className="flex flex-wrap gap-3">
          <button onClick={handleTick} disabled={loading}
            className="flex items-center gap-2 bg-teal-600 text-white rounded-2xl px-5 py-3 font-bold text-sm hover:bg-teal-700 transition-all disabled:opacity-50">
            <Play size={16} /> Tick Manual
          </button>
          <button onClick={handleRestart} disabled={loading}
            className="flex items-center gap-2 bg-amber-500 text-white rounded-2xl px-5 py-3 font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50">
            <RefreshCw size={16} /> Reiniciar
          </button>
          <button onClick={handleGenerateReminders} disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-2xl px-5 py-3 font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50">
            <Send size={16} /> Gerar Lembretes
          </button>
          <button onClick={loadStatus} disabled={loading}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 rounded-2xl px-5 py-3 font-bold text-sm hover:bg-slate-200 transition-all">
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
        <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2"><Clock size={18} className="text-slate-400" /> Ciclo do Agendador</h3>
        <p className="text-sm text-slate-600 font-medium leading-relaxed">
          O agendador executa a cada 5 minutos e processa: lembretes de consulta, confirmações para o dia seguinte,
          pesquisa de satisfação (NPS) pós-consulta, detecção de sessões abandonadas e envio de follow-ups automáticos.
        </p>
      </div>
    </div>
  );
}

function FollowUpPanel({ token }: { token: string | null }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueue = async () => {
    if (!token) return;
    try {
      const data = await apiGet<{ entries: any[]; count: number }>('/api/v2/followup/queue', token);
      setEntries(data.entries || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadQueue() }, [token]);

  const handleCheck = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiPost('/api/v2/followup/check', token, {});
      showToast('success', 'Check de follow-up executado');
      loadQueue();
    } catch (e: any) {
      showToast('error', e.message || 'Erro');
    }
    setLoading(false);
  };

  const handleUnregister = async (sessionId: string) => {
    if (!token) return;
    try {
      await apiPost(`/api/v2/followup/unregister/${sessionId}`, token, {});
      showToast('success', 'Removido da fila de follow-up');
      loadQueue();
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{entries.length} paciente(s) na fila de follow-up</p>
        <button onClick={handleCheck} disabled={loading}
          className="flex items-center gap-2 bg-teal-600 text-white rounded-2xl px-5 py-3 font-bold text-sm hover:bg-teal-700 transition-all disabled:opacity-50">
          <Play size={16} /> Executar Check
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-[28px] p-10 text-center shadow-sm">
          <Bell size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">Nenhum follow-up pendente</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Sessões abandonadas serão detectadas automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any) => (
            <div key={entry.sessionId} className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="font-black text-slate-900">{entry.contactName}</h4>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{entry.contactPhone}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {entry.followUpCount}/3
                  </span>
                  <button onClick={() => handleUnregister(entry.sessionId)}
                    className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-bold text-slate-500">
                <div>
                  <span className="text-[9px] block text-slate-400 uppercase">Estágio</span>
                  {entry.stage || 'novo'}
                </div>
                <div>
                  <span className="text-[9px] block text-slate-400 uppercase">Próximo Follow-up</span>
                  {entry.nextFollowUpAt ? new Date(entry.nextFollowUpAt).toLocaleString('pt-BR') : '-'}
                </div>
                <div>
                  <span className="text-[9px] block text-slate-400 uppercase">Último Contato</span>
                  {entry.lastContactAt ? new Date(entry.lastContactAt).toLocaleString('pt-BR') : '-'}
                </div>
                <div>
                  <span className="text-[9px] block text-slate-400 uppercase">Canal</span>
                  {entry.channel || '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesPanel({ token }: { token: string | null }) {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [triggerEvent, setTriggerEvent] = useState<string>('appointment_reminder');
  const [delayMinutes, setDelayMinutes] = useState('0');
  const [messageTemplate, setMessageTemplate] = useState('');

  const loadTemplates = async () => {
    if (!token) return;
    try {
      const data = await apiGet<AutomationTemplate[]>('/api/v2/automation/templates', token);
      setTemplates(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadTemplates() }, [token]);

  const handleCreate = async () => {
    if (!token || !name || !messageTemplate) return;
    try {
      await apiPost('/api/v2/automation/templates', token, {
        name, channel, triggerEvent, delayMinutes: Number(delayMinutes), messageTemplate, variables: [], isActive: true,
      });
      showToast('success', 'Modelo de automação criado');
      setIsModalOpen(false);
      setName(''); setMessageTemplate(''); setDelayMinutes('0');
      loadTemplates();
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao criar modelo');
    }
  };

  const handleToggleActive = async (template: AutomationTemplate) => {
    if (!token) return;
    try {
      await apiPatch(`/api/v2/automation/templates/${template.id}`, token, { isActive: !template.isActive });
      loadTemplates();
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await apiDelete(`/api/v2/automation/templates/${id}`, token);
      showToast('success', 'Modelo removido');
      loadTemplates();
    } catch (e: any) {
      showToast('error', e.message || 'Erro ao remover');
    }
  };

  const triggerLabels: Record<string, string> = {
    appointment_confirmed: 'Confirmação de Consulta',
    appointment_reminder: 'Lembrete de Consulta',
    post_appointment: 'Pós-Consulta',
    birthday: 'Aniversário',
    no_show: 'Não Compareceu',
    custom: 'Personalizado',
  };

  return (
    <div className="space-y-6">
      <button onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 bg-teal-600 text-white rounded-2xl px-5 py-3 font-bold text-sm hover:bg-teal-700 transition-all w-fit">
        <Plus size={16} /> Novo Modelo
      </button>

      {templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-[28px] p-10 text-center shadow-sm">
          <Settings size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-500">Nenhum modelo de automação</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Crie modelos para enviar lembretes automáticos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className={`bg-white border rounded-[20px] p-5 shadow-sm transition-all ${t.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h4 className="font-black text-slate-900">{t.name}</h4>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{triggerLabels[t.triggerEvent] || t.triggerEvent} / {t.channel}</p>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-sm text-slate-600 font-medium bg-slate-50 rounded-2xl p-4 mb-4">{t.messageTemplate}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Atraso: {t.delayMinutes}min</span>
                <button onClick={() => handleToggleActive(t)}
                  className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {t.isActive ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-black text-slate-900">Novo Modelo de Automação</h3>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lembrete 24h antes"
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal</span>
                <select value={channel} onChange={e => setChannel(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">E-mail</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evento Gatilho</span>
                <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold">
                  <option value="appointment_reminder">Lembrete de Consulta</option>
                  <option value="appointment_confirmed">Confirmação de Consulta</option>
                  <option value="post_appointment">Pós-Consulta</option>
                  <option value="birthday">Aniversário</option>
                  <option value="no_show">Não Compareceu</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atraso (minutos)</span>
                <input type="number" value={delayMinutes} onChange={e => setDelayMinutes(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo da Mensagem</span>
                <textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={4} placeholder="Olá {{patientName}}, lembrete da sua consulta..."
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold" />
                <p className="text-[10px] text-slate-400 font-medium">Variáveis disponíveis: {'{{patientName}}'}, {'{{doctorName}}'}, {'{{date}}'}, {'{{time}}'}</p>
              </label>
              <button onClick={handleCreate}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all">
                Criar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
