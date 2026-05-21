/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  History, 
  Plus, 
  Stethoscope, 
  Activity, 
  AlertTriangle, 
  Pill, 
  User,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  FileText,
  X
} from 'lucide-react';
import { MOCK_PATIENTS, MOCK_MEDICAL_RECORDS, MedicalRecord, Patient, MedicalRecordEntry } from '../types';
import { useState } from 'react';

export default function MedicalRecords() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  
  const selectedPatient = MOCK_PATIENTS.find(p => p.id === selectedPatientId);
  const selectedRecord = selectedPatientId ? MOCK_MEDICAL_RECORDS[selectedPatientId] : null;
  const selectedEntry = selectedRecord?.entries.find(e => e.id === selectedEntryId);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {!selectedPatientId ? (
        <div className="p-8 h-full overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Prontuários Eletrônicos</h2>
            <p className="text-sm text-slate-500 font-medium">Selecione um paciente para visualizar seu histórico médico completo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_PATIENTS.map((patient) => (
              <div 
                key={patient.id}
                onClick={() => setSelectedPatientId(patient.id)}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                  <User size={40} />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight mb-1">{patient.fullName}</h3>
                <p className="text-xs text-slate-500 font-bold mb-4 uppercase">CPF: {patient.cpf}</p>
                
                <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-between text-blue-600 font-bold text-sm">
                  <span>Abrir Prontuário</span>
                  <ChevronRight size={18} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Record Toolbar */}
          <div className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedPatientId(null)}
                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
              >
                <ChevronRight size={24} className="rotate-180" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-black">
                  {selectedPatient?.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{selectedPatient?.fullName}</h3>
                  <span className="text-xs text-slate-400 font-medium tracking-tight">Paciente ID: {selectedPatientId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-md hover:bg-blue-700 transition-all">
                <Plus size={16} />
                <span>Nova Evolução</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {/* Left Column: Fixed Info */}
            <div className="w-80 border-r border-slate-200 bg-white overflow-y-auto p-6 space-y-8">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity size={14} className="text-blue-500" />
                  Informações Básicas
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Tipo Sanguíneo</span>
                    <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{selectedRecord?.bloodType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Sexo</span>
                    <span className="font-bold text-slate-800">Feminino</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Alergias
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRecord?.allergies.map(a => (
                    <span key={a} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-100">{a}</span>
                  ))}
                  {selectedRecord?.allergies.length === 0 && <span className="text-xs text-slate-400">Nenhuma alergia relatada</span>}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Pill size={14} className="text-blue-500" />
                  Medicamentos Atuais
                </h4>
                <div className="space-y-2">
                  {selectedRecord?.medications.map(m => (
                    <div key={m} className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-bold text-blue-900">{m}</span>
                    </div>
                  ))}
                  {selectedRecord?.medications.length === 0 && <span className="text-xs text-slate-400">Nenhum medicamento de uso contínuo</span>}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Stethoscope size={14} className="text-purple-600" />
                  Doenças Crônicas
                </h4>
                <div className="space-y-2">
                  {selectedRecord?.chronicDiseases.map(d => (
                    <div key={d} className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-xs font-bold text-purple-900">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Timeline / Entries */}
            <div className="flex-1 bg-slate-50/50 overflow-y-auto p-10">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-blue-600">
                    <History size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Histórico de Consultas</h4>
                    <span className="text-xs text-slate-500 font-medium">Linha do tempo de evoluções médicas</span>
                  </div>
                </div>

                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-200 before:via-blue-200 before:to-transparent">
                  {selectedRecord?.entries.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="relative pl-12 group cursor-pointer"
                      onClick={() => setSelectedEntryId(entry.id)}
                    >
                      <div className="absolute left-0 top-1 w-10 h-10 rounded-xl bg-white border-2 border-blue-200 flex items-center justify-center text-blue-600 shadow-sm z-10 group-hover:border-blue-500 transition-colors">
                        <ClipboardCheck size={20} />
                      </div>
                      
                      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{entry.doctorName}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Calendar size={14} />
                              <span className="text-xs font-bold font-mono">{entry.date}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white border border-blue-100 px-2.5 py-1 rounded-lg">Consulta</span>
                        </div>
                        
                        <div className="p-6 space-y-4">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Diagnóstico</span>
                            <p className="text-sm font-bold text-slate-800">{entry.diagnosis || 'Não especificado'}</p>
                          </div>
                          
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Evolução / Notas</span>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{entry.notes}</p>
                          </div>

                          {entry.prescription && (
                            <div className="pt-4 mt-4 border-t border-dashed border-slate-200">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText size={14} className="text-rose-500" />
                                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest font-mono">Prescrição Médica</span>
                              </div>
                              <p className="text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono italic">
                                {entry.prescription}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!selectedRecord?.entries || selectedRecord.entries.length === 0) && (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-300 bg-white rounded-3xl border border-slate-200 border-dashed ml-12">
                      <History size={48} className="mb-4 opacity-30" />
                      <p className="font-bold">Nenhum registro encontrado para este paciente.</p>
                      <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-lg shadow-blue-100">Iniciar Primeira Evolução</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEntry && (
        <EntryModal entry={selectedEntry} onClose={() => setSelectedEntryId(null)} />
      )}
    </div>
  );
}

interface EntryModalProps {
  entry: MedicalRecordEntry;
  onClose: () => void;
}

function EntryModal({ entry, onClose }: EntryModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Detalhes da Consulta</h3>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>{entry.doctorName}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="font-mono">{entry.date}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-blue-500" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnóstico</h4>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-800">{entry.diagnosis || 'Não especificado'}</p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Pill size={16} className="text-rose-500" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prescrição</h4>
                </div>
                <div className={`p-4 rounded-2xl border border-dashed ${entry.prescription ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-sm font-mono ${entry.prescription ? 'text-rose-700 font-bold italic' : 'text-slate-400 font-medium'}`}>
                    {entry.prescription || 'Nenhuma prescrição registrada nesta consulta.'}
                  </p>
                </div>
              </section>
            </div>

            <section className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-slate-400" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução / Notas Médicas</h4>
              </div>
              <div className="flex-1 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                  {entry.notes}
                </p>
              </div>
            </section>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
