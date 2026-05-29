/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Sparkles, Calendar } from 'lucide-react';
import { Appointment, Doctor, Patient } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface ChatAssistantProps {
  token: string | null;
  doctors: Doctor[];
  appointments: Appointment[];
  patients: Patient[];
}

export default function ChatAssistant({ token, doctors, appointments, patients }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'assistant', 
      text: 'Olá! Sou o assistente do Consultio Med. Posso te ajudar a encontrar horários disponíveis ou sugerir datas para seus pacientes. Como posso ajudar?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: input,
          context: {
            doctors,
            appointments,
            patients
          }
        })
      });

      const data = await response.json();
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: data.text || 'Desculpe, tive um problema ao processar sua solicitação.' };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Desculpe, ocorreu um erro na comunicação com o servidor.' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Assistente IA</h2>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
               Disponível <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] flex gap-3">
               <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center animate-pulse">
                <Sparkles size={16} />
              </div>
              <div className="p-4 bg-white text-slate-400 border border-slate-200 shadow-sm rounded-2xl rounded-tl-none text-sm animate-pulse">
                Digitando...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto relative">
          <input 
            type="text" 
            placeholder="Pergunte sobre horários disponíveis ou peça sugestões..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-6 pr-14 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-all disabled:opacity-50 disabled:bg-slate-300"
          >
            <Send size={20} />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button 
            onClick={() => setInput('Quais horários o Dr. Matheus tem amanhã?')}
            className="text-[9px] md:text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
          >
            Horários Dr. Matheus
          </button>
          <button 
            onClick={() => setInput('Sugira uma data para a Bruna Gabriel')}
            className="text-[9px] md:text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 transition-colors"
          >
            Sugestão de data
          </button>
        </div>
      </div>
    </div>
  );
}
