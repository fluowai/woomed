/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { AgendaSubHeader, AppointmentTable } from './components/Agenda';
import Patients from './components/Patients';
import MedicalRecords from './components/MedicalRecords';
import ChatAssistant from './components/ChatAssistant';
import { MessageSquareText, Plus, Search, Calendar, Clock, User, Stethoscope, Sparkles } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS } from './types';

export type ViewType = 'Agenda' | 'Pacientes' | 'Prontuários' | 'Dashboard' | 'Financeiro' | 'Mensagens';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('Agenda');
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Modal states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const [aiSuggestions, setAiSuggestions] = useState<{date: string, time: string, reason: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);

  const selectedDoctor = useMemo(() => MOCK_DOCTORS.find(d => d.id === selectedDoctorId), [selectedDoctorId]);

  // Check for conflicts and trigger AI suggestions
  const checkAvailability = useMemo(() => {
    if (!selectedDoctorId || !selectedDate || !selectedTime) return { hasConflict: false };
    
    const conflict = MOCK_APPOINTMENTS.find(a => 
      a.doctorId === selectedDoctorId && 
      a.date === selectedDate && 
      a.timeStart === selectedTime
    );

    return { hasConflict: !!conflict };
  }, [selectedDoctorId, selectedDate, selectedTime]);

  useEffect(() => {
    if (checkAvailability.hasConflict && !isAiLoading) {
      setHasConflict(true);
      const doctor = MOCK_DOCTORS.find(d => d.id === selectedDoctorId);
      if (doctor) {
        setIsAiLoading(true);
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctor,
            requestedSlot: { date: selectedDate, time: selectedTime },
            currentAppointments: MOCK_APPOINTMENTS.filter(a => a.doctorId === selectedDoctorId)
          })
        }).then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setAiSuggestions(data);
          })
          .catch(err => console.error('Error fetching suggestions:', err))
          .finally(() => setIsAiLoading(false));
      }
    } else if (!checkAvailability.hasConflict) {
      setHasConflict(false);
      setAiSuggestions([]);
    }
  }, [checkAvailability.hasConflict, selectedDoctorId, selectedDate, selectedTime]);

  const renderView = () => {
    switch (activeView) {
      case 'Agenda':
        return (
          <>
            <AgendaSubHeader />
            <div className="flex-1 overflow-hidden relative">
              <AppointmentTable />
            </div>
          </>
        );
      case 'Pacientes':
        return <Patients />;
      case 'Prontuários':
        return <MedicalRecords />;
      case 'Mensagens':
        return <ChatAssistant />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
            <div className="text-center p-10 md:p-20 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg">
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{activeView}</h3>
              <p className="text-slate-500 font-medium">Este módulo está em desenvolvimento para o Consultio Med.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar activeView={activeView} onViewChange={(view) => {
          setActiveView(view);
          setIsSidebarOpen(false);
        }} />
      </div>
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        {renderView()}

        {/* Floating Action Buttons */}
        {activeView !== 'Mensagens' && (
          <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 flex flex-col gap-4 z-30">
            <button 
              onClick={() => setIsSchedulingOpen(true)}
              className="w-14 h-14 md:w-16 md:h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
            >
              <Plus size={28} className="group-hover:rotate-90 transition-transform" />
            </button>
            
            <button 
              onClick={() => setActiveView('Mensagens')}
              className="w-12 h-12 md:w-14 md:h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xl shadow-amber-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
            >
              <MessageSquareText size={24} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        )}

        {/* Simplified Scheduling Modal */}
        {isSchedulingOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Novo Agendamento</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Confirmação em tempo real</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSchedulingOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all font-bold text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={14} className="text-blue-500" />
                        Paciente
                      </label>
                      <select 
                        value={selectedPatientId}
                        onChange={(e) => setSelectedPatientId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full appearance-none font-bold transition-all"
                      >
                        <option value="">Selecione um paciente...</option>
                        {MOCK_PATIENTS.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Stethoscope size={14} className="text-indigo-500" />
                        Profissional (Médico)
                      </label>
                      <select 
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-indigo-100 outline-none w-full appearance-none font-bold transition-all"
                      >
                        <option value="">Selecione o médico...</option>
                        {MOCK_DOCTORS.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Plus size={14} className="text-emerald-500" />
                        Procedimento
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: Consulta Particular" 
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-emerald-100 outline-none font-bold transition-all w-full" 
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={14} className="text-blue-500" />
                          Data
                        </label>
                        <input 
                          type="date" 
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all" 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={14} className="text-blue-500" />
                          Horário
                        </label>
                        <input 
                          type="time" 
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all" 
                        />
                      </div>
                    </div>

                    {selectedDoctor && (
                      <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={14} />
                            {hasConflict ? 'Horário Ocupado — Sugestões IA' : 'Sugestões Disponíveis'}
                          </h4>
                          {isAiLoading && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                        </div>

                        {hasConflict && (
                          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2">
                            <Clock size={14} className="text-rose-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] font-bold text-rose-700 leading-tight">
                              Este horário já está reservado para outro paciente. Veja as alternativas abaixo.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[180px] p-1">
                          {(hasConflict ? aiSuggestions : [
                            { date: '2025-04-03', time: '14:30', reason: 'Horário alternativo' },
                            { date: '2025-04-04', time: '09:00', reason: 'Horário alternativo' },
                          ]).map((s, idx) => (
                            <button 
                              key={idx}
                              onClick={() => {
                                setSelectedDate(s.date);
                                setSelectedTime(s.time);
                              }}
                              className="flex flex-col p-3 bg-white border border-blue-100 rounded-xl hover:border-blue-500 transition-all group text-left"
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <div className="flex items-center gap-2">
                                  <Calendar size={12} className="text-blue-400" />
                                  <span className="text-xs font-bold text-slate-700">{s.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock size={12} className="text-blue-400" />
                                  <span className="text-xs font-black text-blue-600">{s.time}</span>
                                </div>
                              </div>
                              {s.reason && <span className="text-[9px] text-slate-400 font-medium italic truncate">{s.reason}</span>}
                            </button>
                          ))}
                          {hasConflict && aiSuggestions.length === 0 && !isAiLoading && (
                            <p className="text-xs text-slate-400 text-center py-4 italic">Nenhuma sugestão encontrada pelo assistente.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <button 
                    onClick={() => {
                      alert('Notificações enviadas para o paciente via e-mail e SMS!');
                      setIsSchedulingOpen(false);
                      // Reset states
                      setSelectedPatientId('');
                      setSelectedDoctorId('');
                      setSelectedDate('');
                      setSelectedTime('');
                    }}
                    disabled={!selectedPatientId || !selectedDoctorId || !selectedDate || !selectedTime || hasConflict}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl py-5 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-100"
                  >
                    {hasConflict ? 'Horário Indisponível' : 'Finalizar Agendamento'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

