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
  Edit2,
  Check,
  X 
} from 'lucide-react';
import { Doctor, Patient, MedicalRecord, MedicalRecordEntry } from '../types';
import React, { useState, useEffect } from 'react';

interface MedicalRecordsProps {
  patients: Patient[];
  medicalRecords: Record<string, MedicalRecord>;
  doctors: Doctor[];
  onAddMedicalRecordEntry: (patientId: string, entry: MedicalRecordEntry) => void;
  onUpdateMedicalRecordMetadata: (
    patientId: string, 
    metadata: { 
      bloodType: string; 
      allergies: string[]; 
      medications: string[]; 
      chronicDiseases: string[];
      gender: string;
    }
  ) => void;
  activePatientId: string | null;
  onActivePatientIdChange: (id: string | null) => void;
}

export default function MedicalRecords({
  patients,
  medicalRecords,
  doctors,
  onAddMedicalRecordEntry,
  onUpdateMedicalRecordMetadata,
  activePatientId,
  onActivePatientIdChange
}: MedicalRecordsProps) {
  
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  
  // Modal states for New Evolution
  const [isEvolutionOpen, setIsEvolutionOpen] = useState(false);
  const [evoDoctor, setEvoDoctor] = useState('');
  const [evoDiagnosis, setEvoDiagnosis] = useState('');
  const [evoNotes, setEvoNotes] = useState('');
  const [evoPrescription, setEvoPrescription] = useState('');

  // Editing Metadata states
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaBloodType, setMetaBloodType] = useState('A+');
  const [metaGender, setMetaGender] = useState('Feminino');
  const [metaAllergies, setMetaAllergies] = useState('');
  const [metaMedications, setMetaMedications] = useState('');
  const [metaChronic, setMetaChronic] = useState('');

  const selectedPatient = patients.find(p => p.id === activePatientId);
  const selectedRecord = activePatientId ? medicalRecords[activePatientId] : null;
  const selectedEntry = selectedRecord?.entries.find(e => e.id === selectedEntryId);

  useEffect(() => {
    if (!evoDoctor && doctors[0]) {
      setEvoDoctor(doctors[0].name);
    }
  }, [doctors, evoDoctor]);

  // Sync edit form with current records when editing is toggled
  useEffect(() => {
    if (selectedRecord && isEditingMeta) {
      setMetaBloodType(selectedRecord.bloodType || 'A+');
      setMetaGender(selectedRecord.gender || 'Feminino');
      setMetaAllergies(selectedRecord.allergies.join(', '));
      setMetaMedications(selectedRecord.medications.join(', '));
      setMetaChronic(selectedRecord.chronicDiseases.join(', '));
    }
  }, [isEditingMeta, selectedRecord]);

  const handleEvolutionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId || !evoNotes) return;

    const newEntry: MedicalRecordEntry = {
      id: 'e-' + Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      doctorName: evoDoctor,
      notes: evoNotes,
      diagnosis: evoDiagnosis || undefined,
      prescription: evoPrescription || undefined
    };

    onAddMedicalRecordEntry(activePatientId, newEntry);
    
    // Reset form
    setEvoDiagnosis('');
    setEvoNotes('');
    setEvoPrescription('');
    setIsEvolutionOpen(false);
  };

  const handleMetadataSave = () => {
    if (!activePatientId) return;

    const parsedAllergies = metaAllergies.split(',').map(s => s.trim()).filter(Boolean);
    const parsedMedications = metaMedications.split(',').map(s => s.trim()).filter(Boolean);
    const parsedChronic = metaChronic.split(',').map(s => s.trim()).filter(Boolean);

    onUpdateMedicalRecordMetadata(activePatientId, {
      bloodType: metaBloodType,
      allergies: parsedAllergies,
      medications: parsedMedications,
      chronicDiseases: parsedChronic,
      gender: metaGender
    });

    setIsEditingMeta(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {!activePatientId ? (
        <div className="p-4 lg:p-8 h-full overflow-y-auto pb-20">
          <div className="mb-4 lg:mb-8">
            <h2 className="text-lg lg:text-2xl font-bold text-slate-800">Prontuários</h2>
            <p className="hidden lg:block text-sm text-slate-500 font-medium">Selecione um paciente para visualizar seu histórico médico completo.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 pb-20">
            {patients.map((patient) => (
              <div 
                key={patient.id}
                onClick={() => onActivePatientIdChange(patient.id)}
                className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 rounded-[24px] bg-blue-50 border border-slate-100 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform overflow-hidden shrink-0">
                  {patient.avatarUrl ? (
                    <img src={patient.avatarUrl} alt={patient.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={36} />
                  )}
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
          <div className="px-4 lg:px-8 py-3 lg:py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-2 lg:gap-4 min-w-0">
              <button 
                onClick={() => onActivePatientIdChange(null)}
                className="p-1.5 lg:p-2 text-slate-400 hover:text-teal-600 transition-colors"
                title="Voltar para a lista"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-700 font-black overflow-hidden shrink-0">
                  {selectedPatient?.avatarUrl ? (
                    <img src={selectedPatient.avatarUrl} alt={selectedPatient.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm">{selectedPatient?.fullName.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm lg:text-base truncate">{selectedPatient?.fullName}</h3>
                  <span className="text-[10px] lg:text-xs text-slate-400 font-medium">CPF: {selectedPatient?.cpf}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3 shrink-0">
              <button 
                onClick={() => setIsEvolutionOpen(true)}
                className="flex items-center gap-1 lg:gap-2 px-3 lg:px-6 py-2 lg:py-2.5 bg-teal-600 text-white rounded-full font-bold text-[10px] lg:text-xs uppercase tracking-widest shadow-md hover:bg-teal-700 transition-all"
              >
                <Plus size={14} className="lg:size-4" />
                <span className="hidden lg:inline">Nova Evolução</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            {/* Left Column: Fixed Info */}
            <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white overflow-y-auto p-4 lg:p-6 space-y-6 lg:space-y-8 shrink-0">
              
              {/* Dynamic Metadata Card */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} className="text-blue-500" />
                  Ficha Médica Básica
                </h4>
                
                {isEditingMeta ? (
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={handleMetadataSave}
                      className="p-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                      title="Salvar alterações"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setIsEditingMeta(false)}
                      className="p-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsEditingMeta(true)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50"
                    title="Editar informações básicas"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
              </div>

              {isEditingMeta ? (
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Tipo Sanguíneo</label>
                    <select 
                      value={metaBloodType} 
                      onChange={(e) => setMetaBloodType(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="Desconhecido">Desconhecido</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Gênero</label>
                    <select 
                      value={metaGender} 
                      onChange={(e) => setMetaGender(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Feminino">Feminino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Não-Binário">Não-Binário</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Alergias (separadas por vírgula)</label>
                    <input 
                      type="text" 
                      value={metaAllergies} 
                      onChange={(e) => setMetaAllergies(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Medicamentos Contínuos</label>
                    <input 
                      type="text" 
                      value={metaMedications} 
                      onChange={(e) => setMetaMedications(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Doenças Crônicas</label>
                    <input 
                      type="text" 
                      value={metaChronic} 
                      onChange={(e) => setMetaChronic(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Tipo Sanguíneo</span>
                      <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md text-xs">{selectedRecord?.bloodType || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Gênero</span>
                      <span className="font-bold text-slate-800">{selectedRecord?.gender || 'Feminino'}</span>
                    </div>
                  </div>

                  {/* Allergies */}
                  <div>
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-amber-500" />
                      Alergias
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRecord?.allergies.map(a => (
                        <span key={a} className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-bold border border-amber-100">{a}</span>
                      ))}
                      {(!selectedRecord?.allergies || selectedRecord.allergies.length === 0) && (
                        <span className="text-xs text-slate-400 italic">Nenhuma alergia relatada</span>
                      )}
                    </div>
                  </div>

                  {/* Medications */}
                  <div>
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Pill size={12} className="text-blue-500" />
                      Medicamentos Atuais
                    </h5>
                    <div className="space-y-2">
                      {selectedRecord?.medications.map(m => (
                        <div key={m} className="p-2.5 bg-blue-50 rounded-xl border border-blue-100/50 flex items-center gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="text-xs font-bold text-blue-900">{m}</span>
                        </div>
                      ))}
                      {(!selectedRecord?.medications || selectedRecord.medications.length === 0) && (
                        <span className="text-xs text-slate-400 italic">Nenhum medicamento registrado</span>
                      )}
                    </div>
                  </div>

                  {/* Chronic Diseases */}
                  <div>
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Stethoscope size={12} className="text-purple-600" />
                      Doenças Crônicas
                    </h5>
                    <div className="space-y-2">
                      {selectedRecord?.chronicDiseases.map(d => (
                        <div key={d} className="p-2.5 bg-purple-50 rounded-xl border border-purple-100/50 flex items-center gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          <span className="text-xs font-bold text-purple-900">{d}</span>
                        </div>
                      ))}
                      {(!selectedRecord?.chronicDiseases || selectedRecord.chronicDiseases.length === 0) && (
                        <span className="text-xs text-slate-400 italic">Nenhuma patologia crônica cadastrada</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Timeline / Entries */}
            <div className="flex-1 bg-slate-50/50 overflow-y-auto p-6 md:p-10 pb-24">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-blue-600">
                    <History size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Histórico Clínico</h4>
                    <span className="text-xs text-slate-500 font-medium font-bold uppercase tracking-wide">Linha do tempo de consultas e evoluções</span>
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
                      
                      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{entry.doctorName}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Calendar size={14} />
                              <span className="text-xs font-bold font-mono">{entry.date}</span>
                            </div>
                          </div>
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-white border border-blue-100 px-2.5 py-1 rounded-lg">Consulta</span>
                        </div>
                        
                        <div className="p-6 space-y-4">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Diagnóstico</span>
                            <p className="text-sm font-bold text-slate-800">{entry.diagnosis || 'Não especificado'}</p>
                          </div>
                          
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Evolução / Notas</span>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{entry.notes}</p>
                          </div>

                          {entry.prescription && (
                            <div className="pt-4 mt-4 border-t border-dashed border-slate-200">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText size={14} className="text-rose-500" />
                                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest font-mono">Receita / Prescrição</span>
                              </div>
                              <p className="text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono italic whitespace-pre-line">
                                {entry.prescription}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!selectedRecord?.entries || selectedRecord.entries.length === 0) && (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-300 bg-white rounded-[32px] border border-slate-200 border-dashed ml-12">
                      <History size={48} className="mb-4 opacity-30" />
                      <p className="font-bold">Nenhum histórico registrado.</p>
                      <button 
                        onClick={() => setIsEvolutionOpen(true)}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg shadow-blue-100 uppercase tracking-wider"
                      >
                        Iniciar Primeira Evolução
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Evolution Modal Form */}
      {isEvolutionOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto">
          <form 
            onSubmit={handleEvolutionSubmit}
            className="bg-white w-full lg:max-w-2xl rounded-t-[32px] lg:rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col"
          >
            <div className="p-4 lg:p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight text-sm lg:text-base">Nova Evolução</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{selectedPatient?.fullName}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsEvolutionOpen(false)} 
                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all font-bold text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 lg:p-8 space-y-5 lg:space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                
                {/* Doctor Selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissional Responsável *</label>
                  <select 
                    value={evoDoctor}
                    onChange={(e) => setEvoDoctor(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  >
                    {doctors.map(d => <option key={d.id} value={d.name}>{d.name} ({d.specialty})</option>)}
                  </select>
                </div>

                {/* Diagnosis */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnóstico Clínico</label>
                  <input 
                    type="text"
                    value={evoDiagnosis}
                    onChange={(e) => setEvoDiagnosis(e.target.value)}
                    placeholder="Ex: Hipertensão essencial, Lombalgia crônica..."
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Evolution Notes */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução / Notas Clínicas *</label>
                  <textarea 
                    required
                    value={evoNotes}
                    onChange={(e) => setEvoNotes(e.target.value)}
                    rows={5}
                    placeholder="Descreva a queixa do paciente, exames físicos, observações clínicas e conduta adotada..."
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Prescription */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receita Médica / Prescrição</label>
                  <textarea 
                    value={evoPrescription}
                    onChange={(e) => setEvoPrescription(e.target.value)}
                    rows={3}
                    placeholder="Medicamentos prescritos, dosagens e orientações de uso..."
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-mono italic"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 lg:p-6 bg-slate-50 border-t border-slate-100 flex gap-3 lg:gap-4">
              <button 
                type="submit"
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-teal-100"
              >
                Salvar Evolução
              </button>
              <button 
                type="button"
                onClick={() => setIsEvolutionOpen(false)}
                className="px-6 lg:px-8 bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold hover:bg-slate-50 transition-all text-xs uppercase"
              >
                Cancelar
              </button>
            </div>
          </form>
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-2xl rounded-t-[32px] lg:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        <div className="p-4 lg:p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm lg:text-base">Detalhes da Consulta</h3>
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
        
        <div className="p-4 lg:p-8 overflow-y-auto space-y-6 lg:space-y-8 flex-1">
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

        <div className="p-4 lg:p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="w-full lg:w-auto px-8 py-3 lg:py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
