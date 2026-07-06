import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Circle,
  Download,
  FileAudio,
  FileText,
  Image,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Trash2,
  Unplug,
  UserRound,
  Users,
  Video,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api';
import {
  WhatsAppConnection,
  WhatsAppConversation,
  WhatsAppMessage
} from '../types';

interface WhatsAppProps {
  token: string | null;
  onOpenConnections?: () => void;
}

interface ConnectionsResponse {
  connections: WhatsAppConnection[];
}

interface ConversationsResponse {
  conversations: WhatsAppConversation[];
}

interface MessagesResponse {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
}

interface SocketEvent {
  type: string;
  payload: unknown;
  at: string;
}

const statusStyles: Record<WhatsAppConnection['status'], { label: string; className: string; dot: string }> = {
  connected: {
    label: 'Conectado',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  connecting: {
    label: 'Conectando',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500'
  },
  qr: {
    label: 'QR pendente',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500'
  },
  disconnected: {
    label: 'Desconectado',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400'
  },
  error: {
    label: 'Erro',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500'
  }
};

function useWhatsAppRealtime(token: string | null, onEvent: (event: SocketEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/whatsapp/ws?token=${encodeURIComponent(token)}`);

    socket.onmessage = (event) => {
      try {
        onEventRef.current(JSON.parse(event.data));
      } catch {
        // Ignore malformed realtime packets from development proxies.
      }
    };

    return () => socket.close();
  }, [token]);
}

function formatDateTime(value?: string) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function displayWhatsAppNumber(value?: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || value || '';
}

function displayWhatsAppIdentity(value?: string) {
  if (!value) return '';
  return /^\+?\d[\d\s().-]*$/.test(value) ? displayWhatsAppNumber(value) : value;
}

function Avatar({ src, label, group = false }: { src?: string; label: string; group?: boolean }) {
  return (
    <div className="relative w-11 h-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
      {src ? (
        <img src={src} alt={label} className="w-full h-full object-cover" />
      ) : group ? (
        <Users size={20} className="text-slate-500" />
      ) : (
        <UserRound size={20} className="text-slate-500" />
      )}
    </div>
  );
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaAttachment({ message }: { message: WhatsAppMessage }) {
  if (message.type === 'image') {
    if (message.mediaUrl) {
      return <img src={message.mediaUrl} alt={message.mediaFileName || 'Imagem da mensagem'} className="mb-3 max-h-72 rounded-lg object-cover border border-white/30" />;
    }
    return (
      <div className="mb-2 flex items-center gap-2 text-xs font-bold opacity-80">
        <Image size={14} />
        Imagem recebida
      </div>
    );
  }

  if (message.type === 'audio') {
    return (
      <div className="mb-2 rounded-lg bg-black/5 p-2">
        {message.mediaUrl ? (
          <audio src={message.mediaUrl} controls className="w-full h-9" />
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold opacity-80"><FileAudio size={14} /> Audio recebido</div>
        )}
      </div>
    );
  }

  if (message.type === 'video') {
    return message.mediaUrl ? (
      <video src={message.mediaUrl} controls className="mb-3 max-h-72 rounded-lg border border-white/30" />
    ) : (
      <div className="mb-2 flex items-center gap-2 text-xs font-bold opacity-80"><Video size={14} /> Video recebido</div>
    );
  }

  if (message.type === 'document') {
    const label = message.mediaFileName || message.mediaMimeType || 'Documento recebido';
    return (
      <a
        href={message.mediaUrl || '#'}
        target="_blank"
        rel="noreferrer"
        className={`mb-2 flex items-center gap-3 rounded-lg p-3 ${message.fromMe ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-700'}`}
      >
        <FileText size={18} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black truncate">{label}</span>
          <span className="block text-[10px] font-semibold opacity-70">{formatFileSize(message.mediaSize) || message.mediaMimeType || 'PDF/DOC'}</span>
        </span>
        {message.mediaUrl && <Download size={15} />}
      </a>
    );
  }

  return null;
}

function ConnectionBadge({ status }: { status: WhatsAppConnection['status'] }) {
  const style = statusStyles[status] || statusStyles.disconnected;
  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-[11px] font-bold ${style.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function WhatsAppConnections({ token }: WhatsAppProps) {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadConnections = useCallback(async () => {
    const response = await apiGet<ConnectionsResponse>('/api/whatsapp/connections', token);
    setConnections(response.connections);
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    loadConnections()
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar conexoes.'))
      .finally(() => setIsLoading(false));
  }, [loadConnections]);

  useWhatsAppRealtime(token, (event) => {
    if (event.type === 'whatsapp.connection' || event.type === 'whatsapp.sync') {
      loadConnections().catch(() => undefined);
    }
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError('');
    setIsCreating(true);
    try {
      const response = await apiPost<{ connection: WhatsAppConnection }>('/api/whatsapp/connections', token, { name });
      setConnections((prev) => [response.connection, ...prev]);
      const newId = response.connection.id;
      const connectResponse = await apiPost<{ connection: WhatsAppConnection }>(`/api/whatsapp/connections/${newId}/connect`, token);
      setConnections((prev) => prev.map((item) => item.id === connectResponse.connection.id ? connectResponse.connection : item));
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conexao.');
    } finally {
      setIsCreating(false);
    }
  };

  const runConnectionAction = async (connectionId: string, action: 'connect' | 'disconnect' | 'sync' | 'delete') => {
    setBusyId(connectionId);
    setError('');
    try {
      if (action === 'delete') {
        await apiDelete(`/api/whatsapp/connections/${connectionId}`, token);
        setConnections((prev) => prev.filter((item) => item.id !== connectionId));
      } else {
        const response = await apiPost<{ connection: WhatsAppConnection }>(`/api/whatsapp/connections/${connectionId}/${action}`, token);
        setConnections((prev) => prev.map((item) => item.id === response.connection.id ? response.connection : item));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar acao.');
      loadConnections().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Conexoes WhatsApp</h2>
                  <p className="text-xs font-semibold text-slate-500">Pareamento via whatsmeow — crie e escaneie o QR Code.</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg px-4 py-3 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  placeholder="Nome da instancia"
                />
                <button
                  onClick={handleCreate}
                  disabled={isCreating || !name.trim()}
                  className="h-11 px-4 bg-emerald-600 text-white rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isCreating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                  {isCreating ? 'Conectando...' : 'Criar e Conectar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm font-bold text-slate-500">
            Carregando conexoes...
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {connections.map((connection) => (
              <div key={connection.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <Avatar src={connection.profileImageUrl} label={connection.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-black text-slate-900 truncate">{connection.name}</h3>
                      <ConnectionBadge status={connection.status} />
                    </div>
                    <p className="text-xs font-bold text-slate-500">{connection.phoneNumber || 'Aguardando conexao...'}</p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Ultima sync: {formatDateTime(connection.lastSyncAt)}</p>
                  </div>
                </div>

                {connection.error && (
                  <div className="mt-4 border border-rose-100 bg-rose-50 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700">
                    {connection.error}
                  </div>
                )}

                {connection.qrCode && (
                  <div className="mt-4 border border-blue-100 bg-blue-50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-blue-700 font-black text-xs uppercase tracking-widest mb-3">
                      <QrCode size={15} />
                      Escaneie o QR Code com o WhatsApp
                    </div>
                    {connection.qrCode.startsWith('data:image') ? (
                      <img src={connection.qrCode} alt="QR WhatsApp" className="w-52 h-52 mx-auto bg-white border border-blue-100 rounded-xl object-contain" />
                    ) : (
                      <pre className="bg-white border border-blue-100 rounded-lg p-3 text-[11px] text-blue-900 whitespace-pre-wrap break-all">{connection.qrCode}</pre>
                    )}
                  </div>
                )}

                {connection.status === 'connected' || connection.status === 'connecting' || connection.status === 'qr' ? (
                  <div className="flex gap-2 mt-5">
                    <button
                      disabled={busyId === connection.id}
                      onClick={() => runConnectionAction(connection.id, 'sync')}
                      className="flex-1 h-10 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-200"
                    >
                      <RefreshCw size={15} className={busyId === connection.id ? 'animate-spin' : ''} />
                      Sync
                    </button>
                    <button
                      disabled={busyId === connection.id}
                      onClick={() => runConnectionAction(connection.id, 'disconnect')}
                      className="flex-1 h-10 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-rose-100"
                    >
                      <Unplug size={15} />
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-5">
                    <button
                      disabled={busyId === connection.id}
                      onClick={() => runConnectionAction(connection.id, 'connect')}
                      className="flex-1 h-10 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700"
                    >
                      <Wifi size={15} />
                      Conectar
                    </button>
                    <button
                      disabled={busyId === connection.id}
                      onClick={() => runConnectionAction(connection.id, 'sync')}
                      className="flex-1 h-10 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-200"
                    >
                      <RefreshCw size={15} className={busyId === connection.id ? 'animate-spin' : ''} />
                      Sync
                    </button>
                    <button
                      disabled={busyId === connection.id}
                      onClick={() => runConnectionAction(connection.id, 'disconnect')}
                      className="flex-1 h-10 bg-rose-50 text-rose-700 rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-rose-100"
                    >
                      <Unplug size={15} />
                      Sair
                    </button>
                  </div>
                )}

                {busyId === connection.id && (
                  <div className="mt-3 text-xs font-bold text-slate-500 text-center">
                    {isCreating ? 'Conectando...' : 'Processando...'}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    disabled={busyId === connection.id}
                    onClick={() => {
                      if (window.confirm(`Remover conexão "${connection.name}"?`)) {
                        runConnectionAction(connection.id, 'delete');
                      }
                    }}
                    className="h-8 px-3 bg-white text-rose-500 border border-rose-200 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Remover
                  </button>
                </div>
              </div>
            ))}

            {connections.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm font-bold text-slate-500 xl:col-span-2">
                Nenhuma conexao cadastrada. Crie uma instancia com o nome desejado e escaneie o QR Code.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function WhatsAppInbox({ token, onOpenConnections }: WhatsAppProps) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [conversationKind, setConversationKind] = useState<'all' | WhatsAppConversation['kind']>('all');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [query, setQuery] = useState('');
  const [reply, setReply] = useState('');
  const [leadDraft, setLeadDraft] = useState('');
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const selectedIdRef = useRef(selectedConversationId);
  selectedIdRef.current = selectedConversationId;

  const loadConversations = useCallback(async () => {
    const response = await apiGet<ConversationsResponse>('/api/whatsapp/conversations', token);
    setConversations(response.conversations);
    setSelectedConversationId((current) => current || response.conversations[0]?.id || '');
  }, [token]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    const response = await apiGet<MessagesResponse>(`/api/whatsapp/conversations/${conversationId}/messages`, token);
    setSelectedConversation(response.conversation);
    setLeadDraft(response.conversation.leadName);
    setMessages(response.messages);
    setConversations((prev) => prev.map((item) => item.id === response.conversation.id ? response.conversation : item));
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    loadConversations()
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar conversas.'))
      .finally(() => setIsLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId).catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens.'));
    }
  }, [selectedConversationId, loadMessages]);

  useWhatsAppRealtime(token, (event) => {
    if (!event.type.startsWith('whatsapp.')) return;
    loadConversations().catch(() => undefined);
    const currentId = selectedIdRef.current;
    if (currentId) {
      loadMessages(currentId).catch(() => undefined);
    }
  });

  const filteredConversations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (conversationKind !== 'all' && conversation.kind !== conversationKind) return false;
      if (!term) return true;
      const haystack = [
        conversation.leadName,
        conversation.title,
        conversation.pushName,
        conversation.phone,
        conversation.groupName,
        conversation.lastMessagePreview,
        ...conversation.participants.map((participant) => `${participant.name} ${participant.phone || ''}`)
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [conversations, conversationKind, query]);

  const directCount = useMemo(() => conversations.filter((conversation) => conversation.kind === 'direct').length, [conversations]);
  const groupCount = useMemo(() => conversations.filter((conversation) => conversation.kind === 'group').length, [conversations]);

  const saveLeadName = async () => {
    if (!selectedConversation || !leadDraft.trim()) return;
    const response = await apiPatch<{ conversation: WhatsAppConversation }>(
      `/api/whatsapp/conversations/${selectedConversation.id}/lead`,
      token,
      { leadName: leadDraft.trim() }
    );
    setSelectedConversation(response.conversation);
    setConversations((prev) => prev.map((item) => item.id === response.conversation.id ? response.conversation : item));
    setIsEditingLead(false);
  };

  const sendMessage = async () => {
    if (!selectedConversation || !reply.trim() || isSending) return;
    setIsSending(true);
    setError('');
    try {
      const response = await apiPost<{ conversation: WhatsAppConversation; message: WhatsAppMessage }>('/api/whatsapp/messages', token, {
        conversationId: selectedConversation.id,
        body: reply
      });
      setReply('');
      setSelectedConversation(response.conversation);
      setMessages((prev) => [...prev, response.message]);
      setConversations((prev) => prev.map((item) => item.id === response.conversation.id ? response.conversation : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden">
      <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="bg-white border-r border-slate-200 min-h-0 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">WhatsApp</h2>
                <p className="text-[11px] font-semibold text-slate-500">Conversas e grupos</p>
              </div>
              <button
                onClick={onOpenConnections}
                title="Conexoes"
                className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100"
              >
                <Power size={17} />
              </button>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                placeholder="Buscar por nome, grupo ou numero"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { id: 'all' as const, label: 'Todas', count: conversations.length, icon: MessageCircle },
                { id: 'direct' as const, label: 'Diretas', count: directCount, icon: UserRound },
                { id: 'group' as const, label: 'Grupos', count: groupCount, icon: Users }
              ].map((item) => {
                const Icon = item.icon;
                const active = conversationKind === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setConversationKind(item.id)}
                    className={`h-8 rounded-md text-[11px] font-black flex items-center justify-center gap-1.5 ${
                      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={13} />
                    {item.label}
                    <span className={active ? 'text-emerald-600' : 'text-slate-400'}>{item.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-sm font-bold text-slate-500">Carregando...</div>
            ) : filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 flex gap-3 ${
                  selectedConversationId === conversation.id ? 'bg-emerald-50/70' : 'bg-white'
                }`}
              >
                <Avatar src={conversation.profileImageUrl} label={conversation.leadName} group={conversation.kind === 'group'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900 truncate">{displayWhatsAppIdentity(conversation.leadName)}</span>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{formatDateTime(conversation.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {conversation.kind === 'group' ? <Users size={12} className="text-blue-500" /> : <UserRound size={12} className="text-emerald-500" />}
                    <span className="text-[11px] font-semibold text-slate-500 truncate">
                      {conversation.kind === 'group'
                        ? conversation.groupName || conversation.title
                        : displayWhatsAppIdentity(conversation.pushName || conversation.phone || conversation.normalizedPhone)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-slate-500 truncate">{conversation.lastMessagePreview}</p>
                    {conversation.unreadCount > 0 && (
                      <span className="min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {!isLoading && filteredConversations.length === 0 && (
              <div className="p-6 text-sm font-bold text-slate-500">Nenhuma conversa encontrada.</div>
            )}
          </div>
        </aside>

        <section className="min-h-0 flex flex-col bg-slate-50">
          {selectedConversation ? (
            <>
              <div className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={selectedConversation.profileImageUrl} label={selectedConversation.leadName} group={selectedConversation.kind === 'group'} />
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 truncate">{displayWhatsAppIdentity(selectedConversation.leadName)}</h3>
                    <p className="text-xs font-semibold text-slate-500 truncate">
                      {selectedConversation.kind === 'group'
                        ? `${selectedConversation.groupName || selectedConversation.title} - ${selectedConversation.participantCount || selectedConversation.participants.length} participantes`
                        : `${displayWhatsAppIdentity(selectedConversation.pushName || selectedConversation.title)} ${displayWhatsAppNumber(selectedConversation.phone)}`}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-1">
                  <Circle size={8} fill="currentColor" />
                  WebSocket ativo
                </div>
              </div>

              {error && (
                <div className="mx-4 md:mx-6 mt-4 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg px-4 py-3 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] md:max-w-[68%] ${message.fromMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!message.fromMe && selectedConversation.kind === 'group' && (
                        <span className="text-[11px] font-black text-blue-700 px-1">{displayWhatsAppIdentity(message.senderDisplayName)}</span>
                      )}
                      <div className={`rounded-lg px-4 py-3 border text-sm leading-relaxed shadow-sm ${
                        message.fromMe
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-800 border-slate-200'
                      }`}>
                        <MediaAttachment message={message} />
                        {message.body}
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 px-1">
                        {formatDateTime(message.timestamp)} {message.fromMe && message.status ? `- ${message.status}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border-t border-slate-200 p-4">
                <div className="flex items-end gap-3">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="min-h-11 max-h-32 flex-1 resize-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                    placeholder="Responder no WhatsApp"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!reply.trim() || isSending}
                    className="w-11 h-11 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <WifiOff size={34} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-black text-slate-800 mb-1">Sem conversa selecionada</h3>
                <p className="text-sm font-semibold text-slate-500">Conecte um WhatsApp ou selecione uma conversa para ler as mensagens.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden lg:flex bg-white border-l border-slate-200 min-h-0 flex-col">
          {selectedConversation && (
            <>
              <div className="p-5 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar src={selectedConversation.profileImageUrl} label={selectedConversation.leadName} group={selectedConversation.kind === 'group'} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedConversation.kind === 'group' ? 'Grupo' : 'Lead'}</p>
                    <h3 className="font-black text-slate-900 truncate">{displayWhatsAppIdentity(selectedConversation.leadName)}</h3>
                  </div>
                </div>

                {isEditingLead ? (
                  <div className="flex gap-2">
                    <input
                      value={leadDraft}
                      onChange={(event) => setLeadDraft(event.target.value)}
                      className="h-10 min-w-0 flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <button onClick={saveLeadName} className="w-10 h-10 bg-emerald-600 text-white rounded-lg flex items-center justify-center">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setIsEditingLead(false)} className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingLead(true)}
                    className="w-full h-10 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200"
                  >
                    <Pencil size={15} />
                    Editar nome do lead
                  </button>
                )}
              </div>

              <div className="p-5 border-b border-slate-200 space-y-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedConversation.kind === 'group' ? 'Grupo' : 'Conversa direta'}</p>
                </div>
                {selectedConversation.phone && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Numero</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{displayWhatsAppNumber(selectedConversation.phone)}</p>
                  </div>
                )}
                {selectedConversation.pushName && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pushname</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{selectedConversation.pushName}</p>
                  </div>
                )}
              </div>

              {selectedConversation.kind === 'group' && (
                <div className="p-5 min-h-0 flex-1 overflow-y-auto">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Participantes</p>
                  <div className="space-y-3">
                    {selectedConversation.participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-3">
                        <Avatar src={participant.profileImageUrl} label={participant.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{displayWhatsAppIdentity(participant.name)}</p>
                          <p className="text-xs font-semibold text-slate-500 truncate">{displayWhatsAppNumber(participant.phone) || displayWhatsAppNumber(participant.jid)}</p>
                        </div>
                      </div>
                    ))}
                    {selectedConversation.participants.length === 0 && (
                      <p className="text-sm font-semibold text-slate-500">Participantes serao preenchidos pela sincronizacao do grupo.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
