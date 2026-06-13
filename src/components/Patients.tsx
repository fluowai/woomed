/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, UserPlus, FileText, Edit2, Phone, Mail, Calendar, CreditCard, MapPin, Upload, Camera, Image as ImageIcon, X } from 'lucide-react';
import { Patient } from '../types';
import React, { useState, useRef, ChangeEvent } from 'react';

interface PatientsProps {
  patients: Patient[];
  onAddPatient: (newPatient: Patient) => void;
  onEditPatient: (editedPatient: Patient) => void;
  onViewMedicalRecord: (patientId: string) => void;
  onScheduleForPatient: (patientName: string) => void;
}

export default function Patients({ 
  patients, 
  onAddPatient, 
  onEditPatient, 
  onViewMedicalRecord,
  onScheduleForPatient
}: PatientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  
  // Modal states for CRUD
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<Patient | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [zip, setZip] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const filteredPatients = patients.filter(p => 
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm)
  );

  const handleAvatarClick = (patientId: string) => {
    setEditingPatientId(patientId);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingPatientId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const target = patients.find(p => p.id === editingPatientId);
        if (target) {
          onEditPatient({ ...target, avatarUrl: result });
        }
        setEditingPatientId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCreateModal = () => {
    setFullName('');
    setBirthDate('');
    setCpf('');
    setPhone('');
    setEmail('');
    setStreet('');
    setCity('');
    setState('SP');
    setZip('');
    setLgpdConsent(false);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !cpf || !birthDate || !lgpdConsent) return;

    const newPatient: Patient = {
      id: 'p-' + Date.now().toString(),
      fullName,
      birthDate,
      cpf,
      phone,
      email,
      address: {
        street: street || 'Não informado',
        city: city || 'Não informado',
        state: state || 'SP',
        zip: zip || 'Não informado'
      },
      lgpdConsent,
      lgpdConsentAt: new Date().toISOString()
    };

    onAddPatient(newPatient);
    setIsCreateOpen(false);
  };

  const openEditModal = (patient: Patient) => {
    setSelectedPatientForEdit(patient);
    setFullName(patient.fullName);
    setBirthDate(patient.birthDate);
    setCpf(patient.cpf);
    setPhone(patient.phone);
    setEmail(patient.email);
    setStreet(patient.address.street);
    setCity(patient.address.city);
    setState(patient.address.state);
    setZip(patient.address.zip);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientForEdit || !fullName || !cpf) return;

    const updatedPatient: Patient = {
      ...selectedPatientForEdit,
      fullName,
      birthDate,
      cpf,
      phone,
      email,
      address: {
        street,
        city,
        state,
        zip
      }
    };

    onEditPatient(updatedPatient);
    setIsEditOpen(false);
    setSelectedPatientForEdit(null);
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50 pb-20 lg:pb-8">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <div className="min-w-0">
          <h2 className="text-lg lg:text-2xl font-bold text-slate-800">Gestão de Pacientes</h2>
          <p className="text-xs lg:text-sm text-slate-500 font-medium hidden lg:block">Visualize, cadastre e gerencie os pacientes da clínica.</p>
        </div>
        
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all shadow-md active:scale-95"
        >
          <UserPlus size={18} />
          <span className="hidden lg:inline">Cadastrar</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative w-full mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nome ou CPF..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all shadow-sm"
        />
      </div>

      {/* Mobile Patient Cards */}
      <div className="lg:hidden space-y-3">
        {filteredPatients.map((patient) => (
          <div key={patient.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div 
                onClick={() => handleAvatarClick(patient.id)}
                className="relative w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold overflow-hidden shrink-0 cursor-pointer"
              >
                {patient.avatarUrl ? (
                  <img src={patient.avatarUrl} alt={patient.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{patient.fullName.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-black text-slate-800 uppercase tracking-tight block truncate">{patient.fullName}</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">CPF: {patient.cpf}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Phone size={12} className="text-teal-500 shrink-0" />
                  <span className="text-xs text-slate-600">{patient.phone || 'Sem telefone'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
              <button onClick={() => onScheduleForPatient(patient.fullName)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl" title="Agendar">
                <Calendar size={18} />
              </button>
              <button onClick={() => onViewMedicalRecord(patient.id)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl" title="Prontuário">
                <FileText size={18} />
              </button>
              <button onClick={() => openEditModal(patient)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl" title="Editar">
                <Edit2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {filteredPatients.length === 0 && (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Search size={36} className="mb-3 opacity-20" />
            <p className="font-bold text-sm">Nenhum paciente encontrado</p>
            <button className="mt-3 text-teal-600 font-bold text-xs" onClick={() => setSearchTerm('')}>Limpar busca</button>
          </div>
        )}
      </div>

      {/* Desktop Patient Table */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredPatients.length} PACIENTES ENCONTRADOS</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Paciente</th>
                <th className="px-8 py-5">Documentos</th>
                <th className="px-8 py-5">Contato</th>
                <th className="px-8 py-5">Localização</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div 
                        onClick={() => handleAvatarClick(patient.id)}
                        className="relative w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-lg shadow-sm border border-slate-100 cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-teal-500 group/avatar shrink-0"
                        title="Alterar avatar do paciente"
                      >
                        {patient.avatarUrl ? (
                          <img src={patient.avatarUrl} alt={patient.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{patient.fullName.charAt(0)}</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                          <Camera size={16} className="text-white" />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-teal-600 transition-colors">{patient.fullName}</span>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar size={12} className="shrink-0" />
                          <span className="text-xs font-bold">{new Date(patient.birthDate + 'T00:00:00').toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <CreditCard size={14} className="text-slate-400" />
                        <span className="text-xs font-bold font-mono">CPF: {patient.cpf}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-teal-600/60">
                        <FileText size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Histórico Ativo</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone size={14} className="text-teal-500" />
                        <span className="text-xs font-bold">{patient.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Mail size={14} />
                        <span className="text-xs font-medium truncate max-w-[150px]">{patient.email}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin size={16} className="text-rose-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{patient.address.city}, {patient.address.state}</span>
                        <span className="text-[10px] text-slate-400">{patient.address.street}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onScheduleForPatient(patient.fullName)}
                        className="p-2.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all" 
                        title="Agendar Consulta"
                      >
                        <Calendar size={20} />
                      </button>
                      <button 
                        onClick={() => onViewMedicalRecord(patient.id)}
                        className="p-2.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all" 
                        title="Ver Prontuário"
                      >
                        <FileText size={20} />
                      </button>
                      <button 
                        onClick={() => openEditModal(patient)}
                        className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" 
                        title="Editar Cadastro"
                      >
                        <Edit2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredPatients.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="font-bold">Nenhum paciente cadastrado para sua busca.</p>
              <button className="mt-4 text-teal-600 font-bold hover:underline" onClick={() => setSearchTerm('')}>Limpar busca</button>
            </div>
          )}
        </div>
      </div>

      {/* Create Patient Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto">
          <form 
            onSubmit={handleCreateSubmit}
            className="bg-white w-full lg:max-w-2xl rounded-t-[32px] lg:rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight">Cadastrar Novo Paciente</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Novo prontuário será criado automaticamente</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsCreateOpen(false)} 
                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all font-bold text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 lg:p-8 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full name */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo *</label>
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Pedro Henrique Silva"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* CPF */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CPF *</label>
                  <input 
                    type="text" 
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="123.456.789-00"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold font-mono"
                  />
                </div>

                {/* Birth Date */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Nascimento *</label>
                  <input 
                    type="date" 
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Celular / Telefone</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="paciente@email.com"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Address Section */}
                <div className="md:col-span-2 border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">Endereço Residencial</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logradouro / Rua</label>
                      <input 
                        type="text" 
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Ex: Av. Paulista, 1200 - Apto 32"
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</label>
                      <input 
                        type="text" 
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex: São Paulo"
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                      <input 
                        type="text" 
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="SP"
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CEP</label>
                      <input 
                        type="text" 
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="01310-100"
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

                <label className="mx-8 mb-4 flex items-start gap-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lgpdConsent}
                    onChange={(e) => setLgpdConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    required
                  />
                  <span className="text-xs leading-relaxed text-slate-600 font-semibold">
                    Confirmo que o paciente autorizou o tratamento dos dados pessoais e sensiveis para atendimento, gestao clinica e cumprimento de obrigacoes legais.
                  </span>
                </label>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                type="submit"
                disabled={!fullName || !cpf || !birthDate || !lgpdConsent}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-100"
              >
                Concluir Cadastro
              </button>
              <button 
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-8 bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold hover:bg-slate-50 transition-all text-xs uppercase"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Patient Modal */}
      {isEditOpen && selectedPatientForEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto">
          <form 
            onSubmit={handleEditSubmit}
            className="bg-white w-full lg:max-w-2xl rounded-t-[32px] lg:rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight">Editar Cadastro do Paciente</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Modificações salvas em tempo real</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedPatientForEdit(null);
                }} 
                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all font-bold text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 lg:p-8 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full name */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo *</label>
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* CPF */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CPF *</label>
                  <input 
                    type="text" 
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold font-mono"
                  />
                </div>

                {/* Birth Date */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Nascimento *</label>
                  <input 
                    type="date" 
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Celular / Telefone</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                  />
                </div>

                {/* Address Section */}
                <div className="md:col-span-2 border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">Endereço Residencial</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logradouro / Rua</label>
                      <input 
                        type="text" 
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</label>
                      <input 
                        type="text" 
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                      <input 
                        type="text" 
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CEP</label>
                      <input 
                        type="text" 
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                type="submit"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-amber-100"
              >
                Salvar Alterações
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedPatientForEdit(null);
                }}
                className="px-8 bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold hover:bg-slate-50 transition-all text-xs uppercase"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Avatar Upload Modal */}
      {editingPatientId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div className="bg-white w-full lg:max-w-md rounded-t-[32px] lg:rounded-[32px] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Atualizar Foto do Paciente</h3>
              <button 
                onClick={() => setEditingPatientId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-32 h-32 rounded-[24px] bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden">
                {patients.find(p => p.id === editingPatientId)?.avatarUrl ? (
                  <img 
                    src={patients.find(p => p.id === editingPatientId)?.avatarUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ImageIcon size={48} className="text-blue-300" />
                )}
              </div>

              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">Avatar de {patients.find(p => p.id === editingPatientId)?.fullName}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Selecione uma imagem quadrada para melhor visualização.</p>
              </div>

              <div className="grid grid-cols-1 w-full gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-bold transition-all shadow-lg shadow-blue-100 group"
                >
                  <Upload size={20} className="group-hover:-translate-y-1 transition-transform" />
                  <span>Escolher do Computador</span>
                </button>
                
                <button 
                  onClick={() => setEditingPatientId(null)}
                  className="bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
