import { FormEvent, useState } from 'react';
import { Stethoscope, Mail, Lock, User, ShieldCheck } from 'lucide-react';
import { apiPost } from '../api';

interface SetupWizardProps {
  onComplete: (token: string, user: { id: string; name: string; role: string }) => void;
  onSignup?: () => void;
}

export default function SetupWizard({ onComplete, onSignup }: SetupWizardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) { setError('Preencha email e senha.'); return; }
    if (password !== confirmPassword) { setError('Senhas nao conferem.'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return; }

    setIsLoading(true);
    setError('');
    try {
      const result = await apiPost<{ token: string; refreshToken: string; expiresAt: number; user: { id: string; name: string; role: string } }>(
        '/api/v2/setup/complete', null, { email, password, name: name || undefined }
      );
      onComplete(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar super admin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 lg:p-6">
      <div className="w-full lg:max-w-5xl lg:grid lg:grid-cols-[1fr_420px] bg-white lg:border lg:border-slate-200 lg:shadow-2xl lg:rounded-[32px] overflow-hidden min-h-screen lg:min-h-0">
        <div className="hidden lg:flex p-10 md:p-14 bg-teal-700 text-white flex-col justify-between min-h-[520px]">
          <div>
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-8">
              <Stethoscope size={30} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Consultio Med</h1>
            <p className="text-blue-100 leading-relaxed max-w-xl">
              Configure o administrador principal da clinica para comecar a usar o sistema.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <ShieldCheck size={20} className="mb-3 text-blue-100" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Super Admin</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <User size={20} className="mb-3 text-blue-100" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Unico</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <Lock size={20} className="mb-3 text-blue-100" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Seguro</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 lg:p-10 flex flex-col justify-center min-h-screen lg:min-h-0">
          <div className="mb-6 lg:mb-8 text-center lg:text-left">
            <div className="lg:hidden w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Stethoscope size={30} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configuracao Inicial</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Crie o super administrador para comecar.</p>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <User size={12} /> Nome (opcional)
              </label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Super Administrador"
                className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Mail size={12} /> Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@clinica.com"
                className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Lock size={12} /> Senha
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Lock size={12} /> Confirmar Senha
              </label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-700">{error}</div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-teal-100">
              {isLoading ? 'Criando...' : 'Criar Super Admin'}
            </button>
            {onSignup && (
              <button type="button" onClick={onSignup} className="w-full text-sm font-black text-teal-700 hover:text-teal-800 transition-colors">
                Criar conta para minha clinica
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
