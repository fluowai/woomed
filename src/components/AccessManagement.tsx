import { FormEvent, useEffect, useState } from 'react';
import { Edit3, KeyRound, Plus, Trash2, UserCog } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../api';
import { AppUser, UserRole } from '../types';
import { showToast } from './Toast';

interface AccessManagementProps {
  token: string | null;
}

const roles: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'doctor', label: 'Medico' },
  { value: 'reception', label: 'Recepcao' },
  { value: 'finance', label: 'Financeiro' },
];

const emptyForm = { name: '', email: '', password: '', role: 'reception' as UserRole, specialty: '' };

export default function AccessManagement({ token }: AccessManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    apiGet<AppUser[]>('/api/v2/users', token)
      .then(setUsers)
      .catch(error => showToast('error', error instanceof Error ? error.message : 'Erro ao carregar acessos.'));
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editingId) {
        const updated = await apiPut<AppUser>(`/api/v2/users/${editingId}`, token, {
          name: form.name,
          email: form.email,
          role: form.role,
          specialty: form.specialty || undefined,
          isActive: true
        });
        setUsers(current => current.map(user => user.id === updated.id ? updated : user));
        showToast('success', 'Acesso atualizado.');
      } else {
        const created = await apiPost<AppUser>('/api/v2/users', token, {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          specialty: form.specialty || undefined
        });
        setUsers(current => [...current, created]);
        showToast('success', 'Acesso criado.');
      }
      reset();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao salvar acesso.');
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email || '', password: '', role: user.role, specialty: user.specialty || '' });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remover este acesso?')) return;
    try {
      await apiDelete<{ ok: boolean }>(`/api/v2/users/${id}`, token);
      setUsers(current => current.filter(user => user.id !== id));
      showToast('success', 'Acesso removido.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao remover acesso.');
    }
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center">
          <KeyRound size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Acessos</h2>
          <p className="text-sm text-slate-500 font-medium">Gerencie usuarios e permissões da clínica.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="font-black text-slate-900">{editingId ? 'Editar acesso' : 'Novo acesso'}</h3>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="Nome completo" />
          <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="email@clinica.com" />
          {!editingId && <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="Senha inicial" />}
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100">
            {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
          {form.role === 'doctor' && <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-teal-100" placeholder="Especialidade" />}
          <div className="flex gap-3">
            {editingId && <button type="button" onClick={reset} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs uppercase">Cancelar</button>}
            <button type="submit" className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase flex items-center justify-center gap-2">
              <Plus size={16} /> {editingId ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {users.map(user => (
            <div key={user.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <UserCog size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-slate-900 truncate">{user.name}</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase">{user.role}{user.specialty ? ` - ${user.specialty}` : ''}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(user)} className="p-2 rounded-xl text-slate-400 hover:text-teal-700 hover:bg-teal-50"><Edit3 size={18} /></button>
                <button onClick={() => remove(user.id)} className="p-2 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
