/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, User, Zap, Settings, ChevronDown, Copy, CheckCheck } from 'lucide-react';
import { Appointment, Doctor, Patient, LlmProviderConfig } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  provider?: string;
}

interface ChatAssistantProps {
  token: string | null;
  doctors: Doctor[];
  appointments: Appointment[];
  patients: Patient[];
  llmConfigs?: LlmProviderConfig[];
}

const PROVIDER_ICONS: Record<string, string> = {
  gemini: '🟦',
  openai: '🟢',
  groq: '⚡',
  anthropic: '🟣',
  local: '🦙',
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'ChatGPT',
  groq: 'Groq',
  anthropic: 'Claude',
  local: 'Llama (Local)',
};

const QUICK_PROMPTS = [
  { label: '📅 Agenda de hoje', text: 'Quais são os agendamentos de hoje?' },
  { label: '👥 Total de pacientes', text: 'Quantos pacientes estão cadastrados?' },
  { label: '🏥 Próximos horários livres', text: 'Quais são os próximos horários livres disponíveis?' },
  { label: '💰 Resumo financeiro', text: 'Dê um resumo da situação financeira da clínica.' },
  { label: '🩺 Profissionais', text: 'Quais profissionais estão cadastrados e suas especialidades?' },
];

export default function ChatAssistant({ token, doctors, appointments, patients, llmConfigs = [] }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: 'Olá! 👋 Sou o assistente de IA do Consultio Med. Tenho acesso à sua agenda, pacientes e dados da clínica em tempo real.\n\nPosso te ajudar com:\n• Verificar horários disponíveis\n• Resumir informações de pacientes\n• Analisar a agenda do dia\n• Orientar sobre módulos do sistema\n\nConfigure sua chave de API em **LLMs** para ativar Gemini, ChatGPT, Groq ou Claude.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('auto');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const getSelectedProvider = () => {
    if (activeProvider === 'auto') return undefined;
    return llmConfigs.find(c => c.provider === activeProvider && c.isActive);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Build conversation history for multi-turn
    const history = [...messages, userMsg]
      .filter(m => m.id !== '0') // exclude welcome message
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }));

    const selectedLlm = getSelectedProvider();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: text,
          messages: history,
          context: { doctors, appointments, patients },
          provider: selectedLlm ? {
            name: selectedLlm.provider,
            model: selectedLlm.model,
          } : undefined,
        })
      });

      const data = await res.json();
      const providerName = selectedLlm?.provider || 'auto';

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data.text || 'Desculpe, tive um problema ao processar sua solicitação.',
        timestamp: new Date(),
        provider: providerName,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: '❌ Erro de comunicação com o servidor. Verifique se o servidor está rodando.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatText = (text: string) => {
    // Simple markdown-like formatting
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <strong key={i} className="font-bold block">{line.slice(2, -2)}</strong>;
        }
        if (line.startsWith('• ')) {
          return <li key={i} className="ml-2">{line.slice(2)}</li>;
        }
        if (line === '') return <br key={i} />;
        // Handle **bold** inline
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <span key={i} className="block">
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          </span>
        );
      });
  };

  const activeLlms = llmConfigs.filter(c => c.isActive);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50/30 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Assistente IA</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Online · Acesso em tempo real à clínica
            </p>
          </div>
        </div>

        {/* Provider selector */}
        <div className="relative">
          <button
            onClick={() => setShowProviderMenu(!showProviderMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-medium text-slate-700 transition-colors"
          >
            <span>{PROVIDER_ICONS[activeProvider] || '🤖'}</span>
            <span className="hidden md:inline">{activeProvider === 'auto' ? 'Auto' : PROVIDER_LABELS[activeProvider]}</span>
            <ChevronDown size={14} />
          </button>

          {showProviderMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
              <div className="p-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1">Provedor de IA</p>
                <button
                  onClick={() => { setActiveProvider('auto'); setShowProviderMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${activeProvider === 'auto' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  🤖 Auto (melhor disponível)
                </button>
                {activeLlms.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-2">Nenhuma LLM configurada. Vá em LLMs para configurar.</p>
                )}
                {activeLlms.map(llm => (
                  <button
                    key={llm.id}
                    onClick={() => { setActiveProvider(llm.provider); setShowProviderMenu(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${activeProvider === llm.provider ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    {PROVIDER_ICONS[llm.provider] || '🤖'} {llm.name}
                    {llm.isDefault && <span className="ml-auto text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase">padrão</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6" onClick={() => setShowProviderMenu(false)}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md mt-1">
                <Sparkles size={14} className="text-white" />
              </div>
            )}

            <div className={`max-w-[78%] group relative`}>
              <div className={`px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none'
                  : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="space-y-0.5">{formatText(msg.text)}</div>
                ) : (
                  msg.text
                )}
              </div>

              {/* Meta info */}
              <div className={`flex items-center gap-2 mt-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className="text-[10px] text-slate-400">
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.provider && msg.provider !== 'auto' && (
                  <span className="text-[10px] text-slate-400">· {PROVIDER_ICONS[msg.provider]} {PROVIDER_LABELS[msg.provider]}</span>
                )}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    {copiedId === msg.id ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                <User size={14} className="text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 mt-1 animate-pulse">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 md:px-8 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.text}
              onClick={() => setInput(p.text)}
              className="shrink-0 text-[10px] md:text-xs font-semibold text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-3 py-2 rounded-full transition-all whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 md:px-8 pb-6 bg-white border-t border-slate-200 pt-4">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pergunte sobre a agenda, pacientes ou qualquer dúvida... (Enter para enviar)"
              className="w-full bg-transparent px-5 py-4 text-sm text-slate-800 placeholder-slate-400 resize-none outline-none leading-relaxed"
              style={{ maxHeight: '160px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-blue-200 shrink-0"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
          Shift+Enter para nova linha · Enter para enviar
        </p>
      </div>
    </div>
  );
}
