import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch } from '../api';
import { showToast } from './Toast';
import { NpsSurvey, NpsResponse, NpsMetrics, LgpdConsentTemplate, LgpdPatientConsent, LgpdDataSubjectRequest, LgpdSensitiveAccessLog, ConsentType } from '../types';
import { ThumbsUp, Shield, Plus, Search, BarChart3, CheckCircle2, XCircle, AlertTriangle, FileText, Eye, Download, Trash2 } from 'lucide-react';

interface NpsLgpdModuleProps {
  token: string | null;
  userRole: string;
}

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

function Modal({ onClose, children }: { onClose: () => void; children: any }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function NpsLgpdModule({ token, userRole }: NpsLgpdModuleProps) {
  const [activeTab, setActiveTab] = useState<'nps' | 'lgpd'>('nps');

  const tabs = [
    { id: 'nps', label: 'NPS', icon: ThumbsUp },
    { id: 'lgpd', label: 'LGPD', icon: Shield }
  ] as const;

  return (
    <Shell title="NPS & LGPD" subtitle="Pesquisa de satisfação e compliance de dados" icon={<Shield size={24} />}>
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

      {activeTab === 'nps' && <NpsModule token={token} userRole={userRole} />}
      {activeTab === 'lgpd' && <LgpdModule token={token} userRole={userRole} />}
    </Shell>
  );
}

function NpsModule({ token }: { token: string | null; userRole: string }) {
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
  const [responses, setResponses] = useState<NpsResponse[]>([]);
  const [metrics, setMetrics] = useState<NpsMetrics | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [activeSection, setActiveSection] = useState<'metrics' | 'surveys' | 'responses'>('metrics');

  useEffect(() => {
    Promise.all([
      apiGet<NpsSurvey[]>('/api/v2/nps/surveys', token),
      apiGet<NpsResponse[]>('/api/v2/nps/responses', token),
      apiGet<NpsMetrics>('/api/v2/nps/metrics', token)
    ]).then(([s, r, m]) => { setSurveys(s); setResponses(r); setMetrics(m); })
      .catch(() => showToast('error', 'Erro ao carregar dados NPS.'));
  }, [token]);

  const scoreColor = metrics?.npsScore !== undefined
    ? metrics.npsScore >= 75 ? 'text-green-600' : metrics.npsScore >= 50 ? 'text-amber-600' : 'text-red-600'
    : '';

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {['metrics', 'surveys', 'responses'].map(s => (
          <button key={s} onClick={() => setActiveSection(s as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {s === 'metrics' ? 'Métricas' : s === 'surveys' ? 'Pesquisas' : 'Respostas'}
          </button>
        ))}
        <button onClick={() => setShowSurveyModal(true)} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
          <Plus size={14} /> Nova Pesquisa
        </button>
      </div>

      {activeSection === 'metrics' && metrics && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NPS Score</p>
              <p className={`text-5xl font-black ${scoreColor}`}>{metrics.npsScore}</p>
              <p className="text-xs text-slate-400 mt-1">{metrics.totalResponses} respostas</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Promotores</p>
              <p className="text-3xl font-black text-emerald-600">{metrics.promotersPercent}%</p>
              <p className="text-xs text-slate-400">{metrics.promoters} respostas</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Neutros</p>
              <p className="text-3xl font-black text-amber-600">{metrics.neutralsPercent}%</p>
              <p className="text-xs text-slate-400">{metrics.neutrals} respostas</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">Detratores</p>
              <p className="text-3xl font-black text-red-600">{metrics.detractorsPercent}%</p>
              <p className="text-xs text-slate-400">{metrics.detractors} respostas</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Distribuição das Notas</h3>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                const count = metrics.responsesByScore[score] || 0;
                const pct = metrics.totalResponses > 0 ? (count / metrics.totalResponses) * 100 : 0;
                const color = score >= 9 ? 'bg-green-500' : score >= 7 ? 'bg-amber-400' : 'bg-red-400';
                return (
                  <div key={score} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-6 text-right">{score}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden">
                      <div className={`h-full ${color} rounded-lg transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'surveys' && (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
          {surveys.map(survey => (
            <div key={survey.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">{survey.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{survey.question} • Enviar após {survey.sendAfterHours}h</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${survey.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {survey.isActive ? 'Ativa' : 'Inativa'}
              </span>
            </div>
          ))}
          {surveys.length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhuma pesquisa NPS configurada.</p>}
        </div>
      )}

      {activeSection === 'responses' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {responses.map(r => (
              <div key={r.id} className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${r.category === 'promotor' ? 'bg-green-500' : r.category === 'neutro' ? 'bg-amber-500' : 'bg-red-500'}`}>
                  {r.score}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 capitalize">{r.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.score >= 9 ? 'bg-green-100 text-green-700' : r.score >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {r.score}/10
                    </span>
                  </div>
                  {r.comment && <p className="text-xs text-slate-400 mt-0.5">{r.comment}</p>}
                  <p className="text-[10px] text-slate-300 mt-1">{new Date(r.respondedAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))}
            {responses.length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhuma resposta NPS registrada.</p>}
          </div>
        </div>
      )}

      {showSurveyModal && (
        <Modal onClose={() => setShowSurveyModal(false)}>
          <SurveyForm token={token} onSave={() => { setShowSurveyModal(false); window.location.reload(); }} />
        </Modal>
      )}
    </div>
  );
}

function SurveyForm({ token, onSave }: { token: string | null; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', question: 'De 0 a 10, o quanto voce recomendaria nossa clinica para um amigo ou familiar?', sendAfterHours: 24 });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name) return showToast('error', 'Nome obrigatório.');
    setIsSaving(true);
    try {
      await apiPost('/api/v2/nps/surveys', token, form);
      showToast('success', 'Pesquisa NPS criada!');
      onSave();
    } catch (e: any) { showToast('error', e.message); }
    setIsSaving(false);
  };

  return (
    <div className="p-8">
      <h3 className="text-lg font-black text-slate-800 mb-6">Nova Pesquisa NPS</h3>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nome</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Pesquisa pós-consulta" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pergunta</label>
          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none h-20 resize-none"
            value={form.question} onChange={e => setForm({...form, question: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Enviar após (horas)</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" type="number"
            value={form.sendAfterHours} onChange={e => setForm({...form, sendAfterHours: Number(e.target.value)})} />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600">Cancelar</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50">
          {isSaving ? 'Salvando...' : 'Criar Pesquisa'}
        </button>
      </div>
    </div>
  );
}

function LgpdModule({ token }: { token: string | null; userRole: string }) {
  const [templates, setTemplates] = useState<LgpdConsentTemplate[]>([]);
  const [dsarRequests, setDsarRequests] = useState<LgpdDataSubjectRequest[]>([]);
  const [sensitiveLogs, setSensitiveLogs] = useState<LgpdSensitiveAccessLog[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDsarModal, setShowDsarModal] = useState(false);
  const [activeSection, setActiveSection] = useState<'templates' | 'dsar' | 'logs'>('templates');
  const [selectedPatientId, setSelectedPatientId] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet<LgpdConsentTemplate[]>('/api/v2/lgpd/consent-templates', token),
      apiGet<LgpdDataSubjectRequest[]>('/api/v2/lgpd/dsar', token),
      apiGet<LgpdSensitiveAccessLog[]>('/api/v2/lgpd/sensitive-logs', token)
    ]).then(([t, d, l]) => { setTemplates(t); setDsarRequests(d); setSensitiveLogs(l); })
      .catch(() => showToast('error', 'Erro ao carregar dados LGPD.'));
  }, [token]);

  const consentTypeLabels: Record<ConsentType, string> = {
    tratamento_dados: 'Tratamento de Dados', comunicacao_whatsapp: 'Comunicação WhatsApp',
    comunicacao_email: 'Comunicação E-mail', comunicacao_sms: 'Comunicação SMS',
    pesquisa_satisfacao: 'Pesquisa de Satisfação', termo_servico: 'Termo de Serviço',
    politica_privacidade: 'Política de Privacidade'
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {['templates', 'dsar', 'logs'].map(s => (
          <button key={s} onClick={() => setActiveSection(s as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === s ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {s === 'templates' ? 'Consentimentos' : s === 'dsar' ? 'Solicitações' : 'Logs Sensíveis'}
          </button>
        ))}
        <button onClick={() => setShowTemplateModal(true)} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
          <Plus size={14} /> Novo Template
        </button>
        <button onClick={() => setShowDsarModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">
          <FileText size={14} /> Nova Solicitação
        </button>
      </div>

      {activeSection === 'templates' && (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
          {templates.map(t => (
            <div key={t.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">{t.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{consentTypeLabels[t.type]} • v{t.version}</p>
              </div>
              <div className="flex items-center gap-2">
                {t.isRequired && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Obrigatório</span>}
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {t.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhum template de consentimento.</p>}
        </div>
      )}

      {activeSection === 'dsar' && (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100">
          {dsarRequests.map(d => (
            <div key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 capitalize">{d.type === 'export' ? 'Exportação' : d.type === 'rectification' ? 'Correção' : d.type === 'anonymization' ? 'Anonimização' : d.type === 'deletion' ? 'Exclusão' : 'Acesso'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Paciente: {d.patientId} • {new Date(d.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${d.status === 'completed' ? 'bg-green-100 text-green-700' : d.status === 'processing' ? 'bg-blue-100 text-blue-700' : d.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {d.status === 'pending' ? 'Pendente' : d.status === 'processing' ? 'Processando' : d.status === 'completed' ? 'Concluído' : 'Rejeitado'}
              </span>
            </div>
          ))}
          {dsarRequests.length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhuma solicitação DSAR.</p>}
        </div>
      )}

      {activeSection === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <input placeholder="Filtrar por ID do paciente..." value={selectedPatientId}
              onChange={e => setSelectedPatientId(e.target.value)}
              className="w-full max-w-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
          <div className="divide-y divide-slate-100">
            {sensitiveLogs.filter(l => !selectedPatientId || l.patientId.includes(selectedPatientId)).map(log => (
              <div key={log.id} className="p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.accessType === 'view' ? 'bg-blue-100 text-blue-600' : log.accessType === 'edit' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                  {log.accessType === 'view' ? <Eye size={14} /> : log.accessType === 'edit' ? <FileText size={14} /> : <Download size={14} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{log.actorName} - {log.accessType === 'view' ? 'Visualizou' : log.accessType === 'edit' ? 'Editou' : 'Exportou'} {log.entityType}</p>
                  <p className="text-xs text-slate-400">{log.reason} • {new Date(log.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))}
            {sensitiveLogs.length === 0 && <p className="text-center py-8 text-sm text-slate-400 italic">Nenhum log de acesso sensível.</p>}
          </div>
        </div>
      )}

      {showTemplateModal && (
        <Modal onClose={() => setShowTemplateModal(false)}>
          <ConsentTemplateForm token={token} onSave={() => { setShowTemplateModal(false); window.location.reload(); }} />
        </Modal>
      )}

      {showDsarModal && (
        <Modal onClose={() => setShowDsarModal(false)}>
          <DsarForm token={token} onSave={() => { setShowDsarModal(false); window.location.reload(); }} />
        </Modal>
      )}
    </div>
  );
}

function ConsentTemplateForm({ token, onSave }: { token: string | null; onSave: () => void }) {
  const [form, setForm] = useState({ type: 'tratamento_dados', title: '', description: '', isRequired: true } as any);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title || !form.description) return showToast('error', 'Preencha todos os campos.');
    setIsSaving(true);
    try {
      await apiPost('/api/v2/lgpd/consent-templates', token, form);
      showToast('success', 'Template de consentimento criado!');
      onSave();
    } catch (e: any) { showToast('error', e.message); }
    setIsSaving(false);
  };

  return (
    <div className="p-8">
      <h3 className="text-lg font-black text-slate-800 mb-6">Novo Template de Consentimento</h3>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="tratamento_dados">Tratamento de Dados</option>
            <option value="comunicacao_whatsapp">Comunicação WhatsApp</option>
            <option value="comunicacao_email">Comunicação E-mail</option>
            <option value="comunicacao_sms">Comunicação SMS</option>
            <option value="pesquisa_satisfacao">Pesquisa de Satisfação</option>
            <option value="termo_servico">Termo de Serviço</option>
            <option value="politica_privacidade">Política de Privacidade</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Título</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none h-24 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isRequired} onChange={e => setForm({...form, isRequired: e.target.checked})} className="w-4 h-4" />
          <span className="text-sm font-bold text-slate-600">Consentimento obrigatório</span>
        </label>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600">Cancelar</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50">
          {isSaving ? 'Salvando...' : 'Criar Template'}
        </button>
      </div>
    </div>
  );
}

function DsarForm({ token, onSave }: { token: string | null; onSave: () => void }) {
  const [form, setForm] = useState({ patientId: '', type: 'export', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.patientId) return showToast('error', 'ID do paciente obrigatório.');
    setIsSaving(true);
    try {
      await apiPost('/api/v2/lgpd/dsar', token, form);
      showToast('success', 'Solicitação DSAR registrada!');
      onSave();
    } catch (e: any) { showToast('error', e.message); }
    setIsSaving(false);
  };

  return (
    <div className="p-8">
      <h3 className="text-lg font-black text-slate-800 mb-6">Nova Solicitação DSAR</h3>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID do Paciente</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Solicitação</label>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="export">Exportar dados</option>
            <option value="rectification">Corrigir dados</option>
            <option value="anonymization">Anonimizar dados</option>
            <option value="deletion">Excluir dados</option>
            <option value="access">Acessar dados</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none h-20 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600">Cancelar</button>
        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-amber-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50">
          {isSaving ? 'Salvando...' : 'Registrar Solicitação'}
        </button>
      </div>
    </div>
  );
}
