import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Check, CreditCard, Lock, Mail, Phone, User } from 'lucide-react';
import { apiGet, apiPost, BootstrapState } from '../api';
import { AppUser, SaaSPlan } from '../types';

interface ClinicOnboardingProps {
  onBack: () => void;
  onComplete: (token: string, user: AppUser, state: BootstrapState) => void;
}

export default function ClinicOnboarding({ onBack, onComplete }: ClinicOnboardingProps) {
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [form, setForm] = useState({
    clinicName: '',
    legalName: '',
    document: '',
    phone: '',
    ownerName: '',
    ownerEmail: '',
    password: '',
    confirmPassword: '',
    planId: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    apiGet<{ plans: SaaSPlan[] }>('/api/v2/onboarding/plans', null)
      .then(response => {
        setPlans(response.plans);
        setForm(current => ({ ...current, planId: current.planId || response.plans[0]?.id || '' }));
      })
      .catch(() => undefined);
  }, []);

  const selectedPlan = useMemo(() => plans.find(plan => plan.id === form.planId), [plans, form.planId]);

  const formatCurrency = (cents: number) =>
    cents === 0 ? 'Sob consulta' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('As senhas nao conferem.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await apiPost<{ token: string; user: AppUser; state: BootstrapState }>(
        '/api/v2/onboarding/clinic',
        null,
        {
          clinicName: form.clinicName,
          legalName: form.legalName || form.clinicName,
          document: form.document || undefined,
          phone: form.phone || undefined,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          password: form.password,
          planId: form.planId || undefined
        }
      );
      onComplete(result.token, result.user, result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta da clinica.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 lg:p-6">
      <div className="w-full lg:max-w-6xl lg:grid lg:grid-cols-[1fr_460px] bg-white lg:border lg:border-slate-200 lg:shadow-2xl lg:rounded-[28px] overflow-hidden min-h-screen lg:min-h-0">
        <div className="hidden lg:flex p-12 bg-teal-700 text-white flex-col justify-between min-h-[640px]">
          <div>
            <button type="button" onClick={onBack} className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-teal-50 hover:text-white">
              <ArrowLeft size={18} /> Voltar ao login
            </button>
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-8">
              <Building2 size={30} />
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-4">Crie sua clinica</h1>
            <p className="text-teal-50 leading-relaxed max-w-xl">
              O responsavel entra como administrador da clinica e comeca em trial com os dados separados por unidade.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {plans.map(plan => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setForm(current => ({ ...current, planId: plan.id }))}
                className={`text-left rounded-2xl p-4 border transition-all ${form.planId === plan.id ? 'bg-white text-slate-900 border-white' : 'bg-white/10 border-white/15 text-white hover:bg-white/15'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{plan.name}</p>
                    <p className={`text-xs mt-1 ${form.planId === plan.id ? 'text-slate-500' : 'text-teal-50'}`}>{plan.description}</p>
                  </div>
                  {form.planId === plan.id && <Check size={20} className="text-teal-600 shrink-0" />}
                </div>
                <p className="text-lg font-black mt-3">{formatCurrency(plan.priceCents)}{plan.priceCents > 0 ? '/mes' : ''}</p>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 lg:p-10 flex flex-col justify-center min-h-screen lg:min-h-0">
          <button type="button" onClick={onBack} className="lg:hidden mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500">
            <ArrowLeft size={18} /> Voltar ao login
          </button>

          <div className="mb-7">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Onboarding da clinica</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Preencha os dados para ativar o ambiente.</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 size={12} /> Nome da clinica</span>
                <input value={form.clinicName} onChange={e => setForm(f => ({ ...f, clinicName: e.target.value }))} required className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="Clinica Exemplo" />
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Razao social</span>
                <input value={form.legalName} onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="Opcional" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento</span>
                <input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="CNPJ/CPF" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Phone size={12} /> Telefone</span>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="(11) 99999-9999" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><User size={12} /> Responsavel</span>
                <input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} required className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="Nome completo" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Mail size={12} /> Email</span>
                <input type="email" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} required className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="dono@clinica.com" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Lock size={12} /> Senha</span>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="Minimo 8 caracteres" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar senha</span>
                <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold" placeholder="Repita a senha" />
              </label>
            </div>

            <label className="flex flex-col gap-2 lg:hidden">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CreditCard size={12} /> Plano</span>
              <select value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-teal-100 font-bold">
                {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.priceCents)}</option>)}
              </select>
            </label>

            {selectedPlan && (
              <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl text-sm text-teal-800 font-bold">
                Plano selecionado: {selectedPlan.name} - {formatCurrency(selectedPlan.priceCents)}{selectedPlan.priceCents > 0 ? '/mes' : ''}
              </div>
            )}

            {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-700">{error}</div>}

            <button type="submit" disabled={isLoading} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-teal-100">
              {isLoading ? 'Criando ambiente...' : 'Criar conta da clinica'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
