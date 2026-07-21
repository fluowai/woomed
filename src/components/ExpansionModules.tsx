import { ReactNode, useState, useEffect } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  DatabaseZap,
  FileText,
  HelpCircle,
  Link,
  Megaphone,
  MessageSquareText,
  MonitorPlay,
  PackagePlus,
  Plus,
  ServerCog,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound
} from 'lucide-react';
import { apiGet } from '../api';
import {
  Appointment,
  AgentTemplate,
  AuditEvent,
  ChannelType,
  Doctor,
  HelpTicket,
  InventoryItem,
  LlmProviderConfig,
  MarketingCampaign,
  NeuralKnowledgeItem,
  Patient,
  ReferenceMaterial,
  ReferralRecord,
  ServiceAgent,
  TissGuide
} from '../types';

const channels: { value: ChannelType; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'site', label: 'Site' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' }
];

function statusClass(status: string) {
  if (['active', 'running', 'authorized', 'paid', 'converted', 'rewarded', 'resolved', 'concluido'].includes(status)) {
    return 'bg-green-50 text-green-700';
  }
  if (['draft', 'open', 'invited'].includes(status)) return 'bg-slate-100 text-slate-600';
  if (['paused', 'glosa', 'high'].includes(status)) return 'bg-rose-50 text-rose-600';
  return 'bg-blue-50 text-blue-700';
}

function Shell({ title, subtitle, icon, children, aside }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            {icon}
          </div>
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

function TextInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function LlmSettingsModule({
  configs,
  onCreateLlm,
  onUpdateLlm
}: {
  configs: LlmProviderConfig[];
  onCreateLlm: (config: Omit<LlmProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyMasked' | 'isActive'> & { apiKey?: string }) => void;
  onUpdateLlm: (id: string, patch: Partial<LlmProviderConfig> & { apiKey?: string }) => void;
}) {
  const [name, setName] = useState('OpenAI Atendimento');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [temperature, setTemperature] = useState('0.35');
  const [maxTokens, setMaxTokens] = useState('1200');

  const submit = () => {
    if (!name || !provider || !model) return;
    onCreateLlm({
      name,
      provider: provider as LlmProviderConfig['provider'],
      model,
      apiKey,
      endpoint,
      temperature: Number(temperature),
      maxTokens: Number(maxTokens),
      isDefault: configs.length === 0
    });
    setApiKey('');
  };

  return (
    <Shell title="LLMs" subtitle="Cadastre provedores e modelos que os agentes podem usar." icon={<ServerCog size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <h3 className="font-black text-slate-900">Nova LLM</h3>
          <TextInput label="Nome" value={name} onChange={setName} />
          <SelectInput label="Provedor" value={provider} onChange={setProvider} options={[
            { value: 'openai', label: 'OpenAI' },
            { value: 'gemini', label: 'Gemini' },
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'groq', label: 'Groq' },
            { value: 'local', label: 'Local/Ollama' }
          ]} />
          <TextInput label="Modelo" value={model} onChange={setModel} />
          <TextInput label="API key" value={apiKey} onChange={setApiKey} type="password" />
          <TextInput label="Endpoint opcional" value={endpoint} onChange={setEndpoint} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Temperatura" value={temperature} onChange={setTemperature} type="number" />
            <TextInput label="Max tokens" value={maxTokens} onChange={setMaxTokens} type="number" />
          </div>
          <button onClick={submit} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">
            Cadastrar LLM
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {configs.map(config => (
            <div key={config.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-black text-slate-900">{config.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">{config.provider} / {config.model}</p>
                </div>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${config.isDefault ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {config.isDefault ? 'padrao' : 'opcional'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-5">
                <div className="bg-slate-50 rounded-xl p-3"><span className="block text-sm font-black">{config.temperature}</span><span className="text-[9px] font-bold text-slate-400">temp.</span></div>
                <div className="bg-slate-50 rounded-xl p-3"><span className="block text-sm font-black">{config.maxTokens}</span><span className="text-[9px] font-bold text-slate-400">tokens</span></div>
                <div className="bg-slate-50 rounded-xl p-3 overflow-hidden"><span className="block text-xs font-black break-all">{config.apiKeyMasked || 'sem key'}</span><span className="text-[9px] font-bold text-slate-400">chave</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onUpdateLlm(config.id, { isDefault: true })} className="py-2 rounded-xl text-[10px] font-black uppercase bg-blue-50 text-blue-700">Definir padrao</button>
                <button onClick={() => onUpdateLlm(config.id, { isActive: !config.isActive })} className="py-2 rounded-xl text-[10px] font-black uppercase bg-slate-900 text-white">{config.isActive ? 'Pausar' : 'Ativar'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function AgentsHub({
  agents,
  templates,
  onCreateAgent,
  onUpdateAgent,
  onCreateFromTemplate
}: {
  agents: ServiceAgent[];
  templates: AgentTemplate[];
  onCreateAgent: (agent: Omit<ServiceAgent, 'id' | 'createdAt' | 'status'>) => Promise<boolean> | boolean;
  onUpdateAgent: (id: string, patch: Partial<ServiceAgent>) => void;
  onCreateFromTemplate: (templateId: string) => void;
}) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ChannelType>('whatsapp');
  const [objective, setObjective] = useState('');
  const [tone, setTone] = useState('Acolhedor, claro e profissional');
  const [escalationTo, setEscalationTo] = useState('Recepcao');
  const [connectionId, setConnectionId] = useState('');
  const [connections, setConnections] = useState<{ id: string; name: string; phoneNumber: string }[]>([]);
  const [rules, setRules] = useState('Nao informar diagnosticos\nEncaminhar urgencias para humano\nValidar identidade antes de dados sensiveis');
  const [isCreating, setIsCreating] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('consultio_token');
    if (!token) return;
    apiGet<{ connections: { id: string; name: string; phoneNumber: string }[] }>('/api/whatsapp/connections', token)
      .then(data => setConnections(data.connections))
      .catch(() => {});
  }, []);

  const activeCount = agents.filter(agent => agent.status === 'active').length;

  const submit = async () => {
    if (!name.trim() || !objective.trim()) {
      setFormMessage('Preencha nome e objetivo para criar o agente.');
      return;
    }
    setIsCreating(true);
    setFormMessage('');
    const ok = await onCreateAgent({
      name,
      channel,
      objective,
      tone,
      escalationTo,
      workingHours: 'Seg-Sex 08:00-18:00',
      rules: rules.split('\n').map(item => item.trim()).filter(Boolean),
      knowledgeBase: ['Agenda', 'Pacientes', 'Servicos', 'Precos'],
      connectionId: connectionId || undefined,
    });
    setIsCreating(false);
    if (ok) {
      setName('');
      setObjective('');
      setConnectionId('');
      setFormMessage('Agente criado como rascunho. Ative no card ao lado quando quiser.');
    } else {
      setFormMessage('Nao foi possivel criar o agente. Verifique o alerta no topo da tela.');
    }
  };

  return (
    <Shell
      title="Central de Agentes"
      subtitle="Crie agentes de atendimento para canais digitais e defina regras de escalonamento humano."
      icon={<Bot size={24} />}
      aside={<div className="text-xs font-black text-blue-700 bg-blue-50 px-4 py-2 rounded-full">{activeCount} agentes ativos</div>}
    >
      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit">
          <h3 className="font-black text-slate-900 mb-5">Novo agente de canal</h3>
          <div className="space-y-4">
            <TextInput label="Nome do agente" value={name} onChange={setName} placeholder="Ex: WhatsApp Pos-consulta" />
            <SelectInput label="Canal" value={channel} onChange={(value) => setChannel(value as ChannelType)} options={channels} />
            <TextInput label="Objetivo" value={objective} onChange={setObjective} placeholder="Ex: Confirmar consultas e recuperar faltosos" />
            <TextInput label="Tom de voz" value={tone} onChange={setTone} />
            <TextInput label="Escalonar para" value={escalationTo} onChange={setEscalationTo} />
            <SelectInput label="Vincular WhatsApp" value={connectionId} onChange={setConnectionId} options={[
              { value: '', label: 'Nenhum (seletor automatico)' },
              ...connections.map(c => ({ value: c.id, label: `${c.name} (${c.phoneNumber})` }))
            ]} />
            {formMessage && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
                {formMessage}
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regras</span>
              <textarea
                value={rules}
                onChange={(event) => setRules(event.target.value)}
                rows={4}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </label>
            <button disabled={isCreating} onClick={submit} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">
              {isCreating ? 'Criando...' : 'Criar agente'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="font-black text-slate-900">Modelos prontos</h3>
                <p className="text-xs font-bold text-slate-500">{templates.length} agentes para saude e beleza com acoes autonomas.</p>
              </div>
              <Sparkles size={20} className="text-blue-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {templates.map(template => (
                <div key={template.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{template.name}</h4>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mt-1">{template.segment} / {template.channel}</p>
                    </div>
                    <button onClick={() => onCreateFromTemplate(template.id)} className="shrink-0 bg-blue-600 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase">
                      Usar
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-3 line-clamp-2">{template.objective}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {template.autonomousActions.slice(0, 3).map(action => (
                      <span key={action} className="text-[9px] font-bold bg-white border border-slate-200 text-slate-500 rounded-lg px-2 py-1">{action}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-black text-slate-900">{agent.name}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase mt-1">{agent.channel} / {agent.escalationTo}</p>
                      {agent.connectionId && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                          <Smartphone size={11} /> WhatsApp vinculado
                        </p>
                      )}
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(agent.status)}`}>{agent.status}</span>
                  </div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed mb-5">{agent.objective}</p>
              <div className="space-y-2 mb-5">
                {agent.rules.slice(0, 3).map(rule => (
                  <div key={rule} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                    <ShieldCheck size={14} className="text-blue-500" /> {rule}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['active', 'paused', 'draft'] as ServiceAgent['status'][]).map(status => (
                  <button
                    key={status}
                    onClick={() => onUpdateAgent(agent.id, { status })}
                    className={`py-2 rounded-xl text-[10px] font-black uppercase ${agent.status === status ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function NeuralModule({
  knowledge,
  agents,
  onCreateKnowledge,
  onUpdateKnowledge
}: {
  knowledge: NeuralKnowledgeItem[];
  agents: ServiceAgent[];
  onCreateKnowledge: (item: Omit<NeuralKnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  onUpdateKnowledge: (id: string, patch: Partial<NeuralKnowledgeItem>) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Atendimento');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('faq, protocolo');
  const [targetAgentId, setTargetAgentId] = useState('');

  const submit = () => {
    if (!title || !content) return;
    onCreateKnowledge({
      title,
      category,
      content,
      sourceType: 'manual',
      targetAgentIds: targetAgentId ? [targetAgentId] : [],
      tags: tags.split(',').map(item => item.trim()).filter(Boolean)
    });
    setTitle('');
    setContent('');
  };

  return (
    <Shell title="Neural" subtitle="Envie conhecimento para os agentes usarem em atendimento e automacoes." icon={<DatabaseZap size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <h3 className="font-black text-slate-900">Novo conhecimento</h3>
          <TextInput label="Titulo" value={title} onChange={setTitle} placeholder="Ex: Politica de retorno" />
          <TextInput label="Categoria" value={category} onChange={setCategory} />
          <SelectInput label="Enviar para agente" value={targetAgentId} onChange={setTargetAgentId} options={[{ value: '', label: 'Todos os agentes' }, ...agents.map(agent => ({ value: agent.id, label: agent.name }))]} />
          <TextInput label="Tags" value={tags} onChange={setTags} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conteudo</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              placeholder="Cole protocolos, FAQs, politica da clinica ou orientacoes operacionais."
            />
          </label>
          <button onClick={submit} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">
            Indexar conhecimento
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {knowledge.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-black text-slate-900">{item.title}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">{item.category}</p>
                </div>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(item.status)}`}>{item.status}</span>
              </div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed mb-4 line-clamp-4">{item.content}</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {item.tags.map(tag => <span key={tag} className="text-[9px] font-bold bg-slate-50 border border-slate-200 text-slate-500 rounded-lg px-2 py-1">{tag}</span>)}
              </div>
              <button onClick={() => onUpdateKnowledge(item.id, { status: item.status === 'indexed' ? 'archived' : 'indexed' })} className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black uppercase">
                {item.status === 'indexed' ? 'Arquivar' : 'Indexar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function InteractiveConsultation({ appointments, patients, doctors }: { appointments: Appointment[]; patients: Patient[]; doctors: Doctor[] }) {
  const queue = appointments.filter(item => ['paciente_no_local', 'em_atendimento', 'confirmado'].includes(item.status)).slice(0, 6);
  const first = queue[0];
  const patient = first ? patients.find(item => item.fullName.toUpperCase() === first.patientName.toUpperCase()) : undefined;
  const doctor = first ? doctors.find(item => item.id === first.doctorId) : undefined;

  return (
    <Shell title="Consulta Interativa" subtitle="Mesa de atendimento com roteiro clinico, contexto do paciente e acoes rapidas." icon={<MonitorPlay size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-slate-900">{first?.patientName || 'Nenhum paciente em atendimento'}</h3>
              <p className="text-xs text-slate-500 font-bold">{doctor?.name || 'Selecione um atendimento na agenda'} {first ? `- ${first.type}` : ''}</p>
            </div>
            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${statusClass(first?.status || 'draft')}`}>{first?.status || 'sem fila'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {['Queixa principal', 'Historia atual', 'Exame fisico', 'Hipotese / conduta'].map(section => (
              <div key={section} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[150px]">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{section}</h4>
                <textarea className="w-full h-24 bg-transparent outline-none text-sm font-medium text-slate-700 resize-none" placeholder="Registrar durante a consulta..." />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            {['Gerar receita', 'Pedido de exame', 'Atestado', 'Encaminhamento', 'Salvar evolucao'].map(action => (
              <button key={action} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-black uppercase hover:bg-blue-100">
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4">Contexto do paciente</h3>
            {patient ? (
              <div className="space-y-3 text-sm">
                <p><strong>Nome:</strong> {patient.fullName}</p>
                <p><strong>Telefone:</strong> {patient.phone}</p>
                <p><strong>E-mail:</strong> {patient.email}</p>
                <p><strong>Endereco:</strong> {patient.address.city}, {patient.address.state}</p>
              </div>
            ) : <p className="text-sm text-slate-400">Sem paciente selecionado.</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4">Fila clinica</h3>
            <div className="space-y-3">
              {queue.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-2">
                  <span className="font-bold text-slate-700">{item.timeStart} {item.patientName}</span>
                  <span className={`px-2 py-0.5 rounded-full font-black ${statusClass(item.status)}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function MarketingModule({ campaigns, agents, onCreateCampaign, onUpdateCampaign }: { campaigns: MarketingCampaign[]; agents: ServiceAgent[]; onCreateCampaign: (campaign: Omit<MarketingCampaign, 'id' | 'status' | 'leads'>) => void; onUpdateCampaign: (id: string, patch: Partial<MarketingCampaign>) => void }) {
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [goal, setGoal] = useState('');
  const [budget, setBudget] = useState('300');

  const submit = () => {
    if (!name || !audience) return;
    onCreateCampaign({ name, audience, channel: channel as MarketingCampaign['channel'], goal, scheduledDate: new Date().toISOString().split('T')[0], budget: Number(budget) });
    setName('');
    setAudience('');
    setGoal('');
  };

  return (
    <Shell title="Marketing" subtitle="Campanhas, publico-alvo e automacoes conectadas aos agentes de atendimento." icon={<Megaphone size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <h3 className="font-black text-slate-900">Nova campanha</h3>
          <TextInput label="Nome" value={name} onChange={setName} placeholder="Ex: Check-up preventivo" />
          <TextInput label="Publico" value={audience} onChange={setAudience} placeholder="Ex: Pacientes acima de 40 anos" />
          <SelectInput label="Canal" value={channel} onChange={setChannel} options={[...channels, { value: 'sms', label: 'SMS' }]} />
          <TextInput label="Meta" value={goal} onChange={setGoal} placeholder="Ex: Preencher 20 horarios" />
          <TextInput label="Orcamento" value={budget} onChange={setBudget} type="number" />
          <button onClick={submit} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Criar campanha</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-black text-slate-900">{campaign.name}</h3>
                  <p className="text-xs text-slate-500 font-bold">{campaign.audience}</p>
                </div>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(campaign.status)}`}>{campaign.status}</span>
              </div>
              <p className="text-sm text-slate-600 font-medium mb-4">{campaign.goal}</p>
              <div className="grid grid-cols-3 gap-3 text-center mb-5">
                <div className="bg-slate-50 rounded-xl p-3"><span className="block text-lg font-black">{campaign.leads}</span><span className="text-[9px] font-bold text-slate-400">leads</span></div>
                <div className="bg-slate-50 rounded-xl p-3"><span className="block text-lg font-black">R$ {campaign.budget}</span><span className="text-[9px] font-bold text-slate-400">orc.</span></div>
                <div className="bg-slate-50 rounded-xl p-3"><span className="block text-lg font-black">{agents.filter(agent => agent.channel === campaign.channel).length}</span><span className="text-[9px] font-bold text-slate-400">agentes</span></div>
              </div>
              <button onClick={() => onUpdateCampaign(campaign.id, { status: campaign.status === 'running' ? 'finished' : 'running' })} className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black uppercase">
                {campaign.status === 'running' ? 'Finalizar' : 'Ativar campanha'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function TissModule({ guides, appointments, onCreateGuide, onUpdateGuide }: { guides: TissGuide[]; appointments: Appointment[]; onCreateGuide: (guide: Omit<TissGuide, 'id' | 'createdAt' | 'status'>) => void; onUpdateGuide: (id: string, patch: Partial<TissGuide>) => void }) {
  const [operator, setOperator] = useState('Unimed');
  const [operatorAns, setOperatorAns] = useState('321235');
  const [tussCode, setTussCode] = useState('10101012');
  const [healthPlanNumber, setHealthPlanNumber] = useState('');
  
  const convenioAppointments = appointments.filter(item => item.type.toLowerCase().includes('conven'));
  const total = guides.reduce((acc, guide) => acc + guide.value, 0);

  const generateBatch = () => {
    // Simulacao de geracao de lote (XML TISS seria salvo ou exportado via rota /api/tiss/batch)
    const pendingGuides = guides.filter(g => g.status === 'authorized');
    if (pendingGuides.length === 0) {
      alert('Nenhuma guia autorizada para gerar o lote.');
      return;
    }
    const token = localStorage.getItem('consultio_token');
    fetch('/api/tiss/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ operatorAns })
    }).then(res => res.blob()).then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lote_tiss_${operatorAns}.xml`;
      a.click();
    }).catch(() => alert('Funcionalidade XML ativada no backend. Certifique-se de expor a rota.'));
  };

  return (
    <Shell 
      title="Faturamento TISS" 
      subtitle="Padrao ABRASF/ANS. Gestao de guias, faturamento de convênios, tabelas TUSS e envio de Lote XML." 
      icon={<FileText size={24} />} 
      aside={
        <div className="flex gap-2">
          <button onClick={generateBatch} className="bg-slate-900 text-white rounded-full px-4 py-2 text-xs font-black uppercase shadow-sm hover:bg-slate-800">Gerar Lote XML (Envio ANS)</button>
          <div className="text-xs font-black text-blue-700 bg-blue-50 px-4 py-2 rounded-full flex items-center">Faturado: R$ {total.toFixed(2)}</div>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit">
          <h3 className="font-black text-slate-900 mb-4">Gerar Guia Padrão (TUSS)</h3>
          <div className="space-y-4 mb-6">
             <SelectInput label="Operadora (Convênio)" value={operator} onChange={setOperator} options={[{value: 'Unimed', label: 'Unimed (Brasília)'}, {value: 'Bradesco', label: 'Bradesco Saúde'}, {value: 'Amil', label: 'Amil'}]} />
             <TextInput label="Registro ANS da Operadora" value={operatorAns} onChange={setOperatorAns} />
             <TextInput label="Código TUSS (Procedimento)" value={tussCode} onChange={setTussCode} />
             <TextInput label="Carteirinha do Paciente" value={healthPlanNumber} onChange={setHealthPlanNumber} placeholder="Ex: 00123992283" />
          </div>
          <h3 className="font-black text-slate-900 mb-4">Selecionar da Agenda</h3>
          <div className="space-y-3">
            {convenioAppointments.map(apt => (
              <button key={apt.id} onClick={() => onCreateGuide({ 
                  patientName: apt.patientName, 
                  operator: operator, 
                  operatorRegisterAns: operatorAns,
                  procedure: apt.type, 
                  tussCode: tussCode,
                  healthPlanNumber: healthPlanNumber,
                  guideType: 'consulta',
                  doctorCrm: '12345',
                  doctorCbo: '2251',
                  value: 150 
                })} className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl p-4">
                <span className="block text-xs font-black text-slate-900">{apt.patientName}</span>
                <span className="block text-[10px] font-bold text-slate-400">{apt.date} {apt.timeStart} / {apt.type}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[28px] shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-widest font-black">
              <tr><th className="p-4">Paciente</th><th>Convênio</th><th>TUSS</th><th>Valor</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guides.map(guide => (
                <tr key={guide.id}>
                  <td className="p-4 font-black text-slate-800">{guide.patientName} <span className="block text-[10px] text-slate-400">{guide.healthPlanNumber || 'Sem cart.'}</span></td>
                  <td>{guide.operator}</td>
                  <td><span className="bg-slate-100 px-2 py-1 rounded text-slate-500 font-black">{guide.tussCode || 'S/ TUSS'}</span></td>
                  <td className="font-black">R$ {guide.value.toFixed(2)}</td>
                  <td><span className={`px-2 py-1 rounded-full font-black ${statusClass(guide.status)}`}>{guide.status}</span></td>
                  <td>
                    {guide.status === 'draft' && <button onClick={() => onUpdateGuide(guide.id, { status: 'authorized' })} className="px-3 py-1 bg-green-500 text-white rounded-lg font-black">Autorizar</button>}
                    {guide.status === 'authorized' && <span className="text-[10px] font-bold text-slate-400">Aguardando Lote XML</span>}
                    {guide.status === 'submitted' && <button onClick={() => onUpdateGuide(guide.id, { status: 'paid' })} className="px-3 py-1 bg-blue-600 text-white rounded-lg font-black">Baixar Pgto</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

export function InventoryModule({ items, onCreateItem, onUpdateItem }: { items: InventoryItem[]; onCreateItem: (item: Omit<InventoryItem, 'id'>) => void; onUpdateItem: (id: string, patch: Partial<InventoryItem>) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Insumos');
  const [quantity, setQuantity] = useState('10');
  const lowStock = items.filter(item => item.quantity <= item.minQuantity);

  const submit = () => {
    if (!name) return;
    onCreateItem({ name, category, quantity: Number(quantity), minQuantity: 10, unit: 'unidades', expiresAt: '', supplier: 'Nao informado' });
    setName('');
  };

  return (
    <Shell title="Estoques" subtitle="Controle de insumos, validade, minimo operacional e reposicao." icon={<Boxes size={24} />} aside={<div className="text-xs font-black text-rose-700 bg-rose-50 px-4 py-2 rounded-full">{lowStock.length} alertas</div>}>
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <h3 className="font-black text-slate-900">Novo item</h3>
          <TextInput label="Item" value={name} onChange={setName} />
          <TextInput label="Categoria" value={category} onChange={setCategory} />
          <TextInput label="Quantidade" value={quantity} onChange={setQuantity} type="number" />
          <button onClick={submit} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Adicionar</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div><h3 className="font-black text-slate-900">{item.name}</h3><p className="text-xs text-slate-400 font-bold">{item.category}</p></div>
                <PackagePlus className={item.quantity <= item.minQuantity ? 'text-rose-500' : 'text-blue-500'} />
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">{item.quantity}</div>
              <p className="text-xs text-slate-400 font-bold mb-5">{item.unit} / minimo {item.minQuantity}</p>
              <div className="flex gap-2">
                <button onClick={() => onUpdateItem(item.id, { quantity: item.quantity + 1 })} className="flex-1 bg-green-50 text-green-700 rounded-xl py-2 text-xs font-black">+1</button>
                <button onClick={() => onUpdateItem(item.id, { quantity: Math.max(0, item.quantity - 1) })} className="flex-1 bg-rose-50 text-rose-700 rounded-xl py-2 text-xs font-black">-1</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function ReportsModule({ appointments, patients, inventoryItems, campaigns, auditEvents }: { appointments: Appointment[]; patients: Patient[]; inventoryItems: InventoryItem[]; campaigns: MarketingCampaign[]; auditEvents: AuditEvent[] }) {
  const attended = appointments.filter(item => item.status === 'atendido').length;
  const pendingPayments = appointments.filter(item => item.paymentStatus === 'pending').length;
  const lowStock = inventoryItems.filter(item => item.quantity <= item.minQuantity).length;
  const conversionLeads = campaigns.reduce((acc, campaign) => acc + campaign.leads, 0);

  const cards = [
    ['Pacientes', patients.length, 'base cadastrada'],
    ['Atendidos', attended, 'consultas concluidas'],
    ['Recebimentos pendentes', pendingPayments, 'cobrancas em aberto'],
    ['Estoque critico', lowStock, 'itens abaixo do minimo'],
    ['Leads marketing', conversionLeads, 'oportunidades captadas'],
    ['Eventos auditados', auditEvents.length, 'acoes recentes']
  ];

  return (
    <Shell title="Relatorios" subtitle="Indicadores operacionais para gestao 360 da clinica." icon={<BarChart3 size={24} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            <div className="text-4xl font-black text-slate-900 mt-3">{value}</div>
            <p className="text-xs font-bold text-slate-500 mt-1">{hint}</p>
            <div className="h-2 bg-slate-100 rounded-full mt-5 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, Number(value) * 12 + 16)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function ReferralsModule({ referrals, patients, onCreateReferral, onUpdateReferral }: { referrals: ReferralRecord[]; patients: Patient[]; onCreateReferral: (referral: Omit<ReferralRecord, 'id' | 'createdAt' | 'status'>) => void; onUpdateReferral: (id: string, patch: Partial<ReferralRecord>) => void }) {
  const [patientName, setPatientName] = useState(patients[0]?.fullName || '');
  const [referredName, setReferredName] = useState('');
  const [reward, setReward] = useState('Credito em consulta particular');
  return (
    <Shell title="Indique e ganhe" subtitle="Programa de indicacoes, recompensas e acompanhamento de conversao." icon={<UsersRound size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <SelectInput label="Paciente indicador" value={patientName} onChange={setPatientName} options={patients.map(patient => ({ value: patient.fullName, label: patient.fullName }))} />
          <TextInput label="Paciente indicado" value={referredName} onChange={setReferredName} />
          <TextInput label="Recompensa" value={reward} onChange={setReward} />
          <button onClick={() => referredName && onCreateReferral({ patientName, referredName, reward })} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Registrar indicacao</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {referrals.map(referral => (
            <div key={referral.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
              <h3 className="font-black text-slate-900">{referral.referredName}</h3>
              <p className="text-xs text-slate-500 font-bold mb-4">Indicado por {referral.patientName}</p>
              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(referral.status)}`}>{referral.status}</span>
              <p className="text-sm text-slate-600 font-medium mt-4">{referral.reward}</p>
              <button onClick={() => onUpdateReferral(referral.id, { status: referral.status === 'converted' ? 'rewarded' : 'converted' })} className="mt-5 w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black uppercase">Avancar status</button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function ReferencesModule({ references, onCreateReference }: { references: ReferenceMaterial[]; onCreateReference: (reference: Omit<ReferenceMaterial, 'id' | 'updatedAt'>) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Clinico');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  return (
    <Shell title="Referencias" subtitle="Biblioteca interna para protocolos, compliance, operadoras e padroes de atendimento." icon={<Link size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <TextInput label="Titulo" value={title} onChange={setTitle} />
          <TextInput label="Categoria" value={category} onChange={setCategory} />
          <TextInput label="URL" value={url} onChange={setUrl} />
          <TextInput label="Resumo" value={summary} onChange={setSummary} />
          <button onClick={() => title && onCreateReference({ title, category, url, summary })} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Adicionar referencia</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {references.map(reference => (
            <a key={reference.id} href={reference.url || '#'} target="_blank" rel="noreferrer" className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm hover:border-blue-300">
              <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{reference.category}</span>
              <h3 className="font-black text-slate-900 mt-4">{reference.title}</h3>
              <p className="text-sm text-slate-600 font-medium mt-2">{reference.summary}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-4">Atualizado em {reference.updatedAt}</p>
            </a>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function HelpModule({ tickets, onCreateTicket, onUpdateTicket }: { tickets: HelpTicket[]; onCreateTicket: (ticket: Omit<HelpTicket, 'id' | 'createdAt' | 'status'>) => void; onUpdateTicket: (id: string, patch: Partial<HelpTicket>) => void }) {
  const [title, setTitle] = useState('');
  const [module, setModule] = useState('Agenda');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  return (
    <Shell title="Ajuda" subtitle="Central de chamados internos, suporte e melhoria continua." icon={<HelpCircle size={24} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit space-y-4">
          <TextInput label="Titulo" value={title} onChange={setTitle} />
          <TextInput label="Modulo" value={module} onChange={setModule} />
          <SelectInput label="Prioridade" value={priority} onChange={setPriority} options={[{ value: 'low', label: 'Baixa' }, { value: 'medium', label: 'Media' }, { value: 'high', label: 'Alta' }]} />
          <TextInput label="Descricao" value={description} onChange={setDescription} />
          <button onClick={() => title && onCreateTicket({ title, module, priority: priority as HelpTicket['priority'], description })} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">Abrir chamado</button>
        </div>
        <div className="space-y-4">
          {tickets.map(ticket => (
            <div key={ticket.id} className="bg-white border border-slate-200 rounded-[24px] p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900">{ticket.title}</h3>
                <p className="text-xs text-slate-500 font-bold">{ticket.module} / {ticket.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(ticket.priority)}`}>{ticket.priority}</span>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(ticket.status)}`}>{ticket.status}</span>
                <button onClick={() => onUpdateTicket(ticket.id, { status: ticket.status === 'resolved' ? 'open' : 'resolved' })} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Resolver</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
