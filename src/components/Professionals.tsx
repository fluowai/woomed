import { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, Edit3, Plus, Stethoscope, Trash2, UserRound } from 'lucide-react';
import { Doctor } from '../types';

interface ProfessionalsProps {
  doctors: Doctor[];
  onCreateDoctor: (doctor: Omit<Doctor, 'id'>) => void;
  onUpdateDoctor: (id: string, doctor: Partial<Doctor>) => void;
  onDeleteDoctor: (id: string) => void;
}

const weekDays = [
  { id: 'Monday', label: 'Seg' },
  { id: 'Tuesday', label: 'Ter' },
  { id: 'Wednesday', label: 'Qua' },
  { id: 'Thursday', label: 'Qui' },
  { id: 'Friday', label: 'Sex' },
  { id: 'Saturday', label: 'Sab' },
  { id: 'Sunday', label: 'Dom' },
];

const emptyForm = {
  name: '',
  specialty: '',
  crm: '',
  email: '',
  phone: '',
  availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  workingHours: { start: '08:00', end: '18:00' }
};

export default function Professionals({ doctors, onCreateDoctor, onUpdateDoctor, onDeleteDoctor }: ProfessionalsProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return doctors;
    return doctors.filter(doctor =>
      doctor.name.toLowerCase().includes(term) ||
      doctor.specialty.toLowerCase().includes(term) ||
      doctor.crm?.toLowerCase().includes(term)
    );
  }, [doctors, search]);

  const startEdit = (doctor: Doctor) => {
    setEditingId(doctor.id);
    setForm({
      name: doctor.name,
      specialty: doctor.specialty,
      crm: doctor.crm || '',
      email: doctor.email || '',
      phone: doctor.phone || '',
      availableDays: doctor.availableDays?.length ? doctor.availableDays : emptyForm.availableDays,
      workingHours: doctor.workingHours || emptyForm.workingHours
    });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const toggleDay = (day: string) => {
    setForm(current => ({
      ...current,
      availableDays: current.availableDays.includes(day)
        ? current.availableDays.filter(item => item !== day)
        : [...current.availableDays, day]
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      specialty: form.specialty.trim(),
      crm: form.crm.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      availableDays: form.availableDays,
      workingHours: form.workingHours
    };
    if (editingId) {
      onUpdateDoctor(editingId, payload);
    } else {
      onCreateDoctor(payload);
    }
    reset();
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
            <Stethoscope size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Profissionais</h2>
            <p className="text-sm text-slate-500 font-medium">Cadastre medicos, especialidades e horarios de atendimento.</p>
          </div>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-600">
          {doctors.length} profissional{doctors.length === 1 ? '' : 'is'}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-black text-slate-900">{editingId ? 'Editar profissional' : 'Novo profissional'}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Esses dados alimentam agenda e prontuarios.</p>
          </div>

          <label className="block">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</span>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="Dra. Ana Silva" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Especialidade</span>
            <input required value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="Dermatologia" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CRM/CRO</span>
              <input value={form.crm} onChange={e => setForm(f => ({ ...f, crm: e.target.value }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="CRM 00000" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone</span>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="(11) 99999-9999" />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email de acesso</span>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="medico@clinica.com" />
          </label>

          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dias de atendimento</span>
            <div className="grid grid-cols-7 gap-2 mt-2">
              {weekDays.map(day => {
                const active = form.availableDays.includes(day.id);
                return (
                  <button key={day.id} type="button" onClick={() => toggleDay(day.id)} className={`py-2 rounded-xl text-xs font-black ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicio</span>
              <input type="time" value={form.workingHours.start} onChange={e => setForm(f => ({ ...f, workingHours: { ...f.workingHours, start: e.target.value } }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fim</span>
              <input type="time" value={form.workingHours.end} onChange={e => setForm(f => ({ ...f, workingHours: { ...f.workingHours, end: e.target.value } }))} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" />
            </label>
          </div>

          <div className="flex gap-3">
            {editingId && <button type="button" onClick={reset} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs uppercase">Cancelar</button>}
            <button type="submit" className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2">
              <Plus size={16} /> {editingId ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="Buscar por nome, especialidade ou CRM" />
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map(doctor => (
              <div key={doctor.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <UserRound size={22} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 truncate">{doctor.name}</h4>
                    <p className="text-sm text-slate-500 font-bold">{doctor.specialty}{doctor.crm ? ` - ${doctor.crm}` : ''}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <CalendarDays size={13} /> {doctor.workingHours?.start || '08:00'} as {doctor.workingHours?.end || '18:00'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(doctor)} className="p-2 rounded-xl text-slate-400 hover:text-teal-700 hover:bg-teal-50" title="Editar">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => onDeleteDoctor(doctor.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50" title="Remover">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-slate-500 font-bold">
                Nenhum profissional encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
