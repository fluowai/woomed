import { ReactNode, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HelpCircle,
  Link,
  Megaphone,
  MessageSquareText,
  MonitorPlay,
  PackagePlus,
  Plus,
  Send,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import {
  Appointment,
  AuditEvent,
  ChannelType,
  Doctor,
  HelpTicket,
  InventoryItem,
  MarketingCampaign,
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

export function AgentsHub({
  agents,
  onCreateAgent,
  onUpdateAgent
}: {
  agents: ServiceAgent[];
  onCreateAgent: (agent: Omit<ServiceAgent, 'id' | 'createdAt' | 'status'>) => void;
  onUpdateAgent: (id: string, patch: Partial<ServiceAgent>) => void;
}) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ChannelType>('whatsapp');
  const [objective, setObjective] = useState('');
  const [tone, setTone] = useState('Acolhedor, claro e profissional');
  const [escalationTo, setEscalationTo] = useState('Recepcao');
  const [rules, setRules] = useState('Nao informar diagnosticos\nEncaminhar urgencias para humano\nValidar identidade antes de dados sensiveis');

  const activeCount = agents.filter(agent => agent.status === 'active').length;

  const submit = () => {
    if (!name || !objective) return;
    onCreateAgent({
      name,
      channel,
      objective,
      tone,
      escalationTo,
      workingHours: 'Seg-Sex 08:00-18:00',
      rules: rules.split('\n').map(item => item.trim()).filter(Boolean),
      knowledgeBase: ['Agenda', 'Pacientes', 'Servicos', 'Precos']
    });
    setName('');
    setObjective('');
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
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regras</span>
              <textarea
                value={rules}
                onChange={(event) => setRules(event.target.value)}
                rows={4}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </label>
            <button onClick={submit} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs">
              Criar agente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-black text-slate-900">{agent.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">{agent.channel} / {agent.escalationTo}</p>
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
  const convenioAppointments = appointments.filter(item => item.type.toLowerCase().includes('conven'));
  const total = guides.reduce((acc, guide) => acc + guide.value, 0);
  return (
    <Shell title="TISS" subtitle="Gestao de guias, autorizacoes, envio e acompanhamento de glosas." icon={<FileText size={24} />} aside={<div className="text-xs font-black text-blue-700 bg-blue-50 px-4 py-2 rounded-full">R$ {total.toFixed(2)} em guias</div>}>
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-8">
        <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm h-fit">
          <h3 className="font-black text-slate-900 mb-4">Gerar guia rapida</h3>
          <div className="space-y-3">
            {convenioAppointments.map(apt => (
              <button key={apt.id} onClick={() => onCreateGuide({ patientName: apt.patientName, operator: 'Operadora', procedure: apt.type, value: 150 })} className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl p-4">
                <span className="block text-xs font-black text-slate-900">{apt.patientName}</span>
                <span className="block text-[10px] font-bold text-slate-400">{apt.date} {apt.timeStart} / {apt.type}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[28px] shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-widest font-black">
              <tr><th className="p-4">Paciente</th><th>Operadora</th><th>Procedimento</th><th>Valor</th><th>Status</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guides.map(guide => (
                <tr key={guide.id}>
                  <td className="p-4 font-black text-slate-800">{guide.patientName}</td>
                  <td>{guide.operator}</td>
                  <td>{guide.procedure}</td>
                  <td className="font-black">R$ {guide.value.toFixed(2)}</td>
                  <td><span className={`px-2 py-1 rounded-full font-black ${statusClass(guide.status)}`}>{guide.status}</span></td>
                  <td><button onClick={() => onUpdateGuide(guide.id, { status: guide.status === 'submitted' ? 'paid' : 'submitted' })} className="px-3 py-1 bg-blue-600 text-white rounded-lg font-black">Avancar</button></td>
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
