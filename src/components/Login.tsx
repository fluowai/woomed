import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, Stethoscope, UserRound, ShieldCheck, Mail } from 'lucide-react';
import { AppUser } from '../types';
import { fetchLoginUsers, login, apiPost, apiGet } from '../api';

interface LoginProps {
  onLogin: (token: string, user: AppUser, state: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [tab, setTab] = useState<'pin' | 'email'>('email');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLoginUsers()
      .then(data => {
        setUsers(data);
        setSelectedUserId(data[0]?.id || '');
      })
      .catch(() => undefined);
  }, []);

  const handlePinSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId || !pin) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await login(selectedUserId, pin);
      onLogin(result.token, result.user, result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await apiPost<any>('/api/v2/auth/login', null, { email, password });
      if (result.mfaRequired) {
        const mfaCode = prompt('Digite o codigo MFA:');
        if (!mfaCode) { setIsLoading(false); return; }
        const mfaResult = await apiPost<any>('/api/v2/auth/mfa/verify', null, { mfaToken: result.mfaToken, userId: result.userId, code: mfaCode });
        const bootstrap = await apiGet<any>('/api/bootstrap', mfaResult.token);
        onLogin(mfaResult.token, mfaResult.user, bootstrap);
      } else {
        const bootstrap = await apiGet<any>('/api/bootstrap', result.token);
        onLogin(result.token, result.user, bootstrap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = tab === 'pin' ? handlePinSubmit : handleEmailSubmit;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_420px] bg-white border border-slate-200 shadow-2xl rounded-[32px] overflow-hidden">
        <div className="p-10 md:p-14 bg-blue-700 text-white flex flex-col justify-between min-h-[520px]">
          <div>
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-8">
              <Stethoscope size={30} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Consultio Med</h1>
            <p className="text-blue-100 leading-relaxed max-w-xl">
              Ambiente operacional com agenda, pacientes, prontuario, financeiro, auditoria e perfis de acesso.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <ShieldCheck size={20} className="mb-3 text-blue-100" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Auditoria</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <UserRound size={20} className="mb-3 text-blue-100" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Perfis</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <LockKeyhole size={20} className="mb-3 text-blue-100" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Sessao</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Entrar no sistema</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Use suas credenciais da clinica para continuar.</p>
          </div>

          <div className="flex gap-2 mb-6 bg-slate-100 rounded-2xl p-1">
            {users.length > 0 && (
              <button type="button" onClick={() => setTab('pin')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${tab === 'pin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                <LockKeyhole size={14} className="inline mr-1.5" /> PIN
              </button>
            )}
            <button type="button" onClick={() => setTab('email')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${tab === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <Mail size={14} className="inline mr-1.5" /> Email
            </button>
          </div>

          <div className="space-y-5">
            {tab === 'pin' ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</label>
                  <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold">
                    {users.map(user => <option key={user.id} value={user.id}>{user.name} - {user.role}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN</label>
                  <input type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Digite o PIN" className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</label>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold" />
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-700">{error}</div>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-100">
              {isLoading ? 'Entrando...' : 'Acessar'}
            </button>
          </div>

          {tab === 'pin' && (
            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
              Acesso por PIN e legado e deve ficar restrito a ambientes internos de teste.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
