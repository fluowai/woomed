import { useState, useEffect } from 'react';
import { Calendar, Clock, User, FileText, Star, LogOut, ChevronRight, Stethoscope, Phone, Mail, MapPin, CheckCircle, X } from 'lucide-react';

type PortalView = 'login' | 'dashboard' | 'appointments' | 'history' | 'records' | 'satisfaction';

interface PortalAppointment {
  id: string;
  doctorId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  patientName: string;
  status: string;
  type: string;
  observations?: string;
}

interface PatientProfile {
  id: string;
  fullName: string;
  birthDate: string;
  phone?: string;
  email?: string;
  address?: { street?: string; city?: string; state?: string };
}

export default function PatientPortal() {
  const [view, setView] = useState<PortalView>('login');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('portal_token'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [upcoming, setUpcoming] = useState<PortalAppointment[]>([]);
  const [history, setHistory] = useState<PortalAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [ratedAppointment, setRatedAppointment] = useState<string | null>(null);
  const [satisfactionMsg, setSatisfactionMsg] = useState('');

  useEffect(() => {
    if (token) {
      loadProfile();
      loadUpcoming();
    }
  }, [token]);

  const apiPortal = async (path: string, options?: RequestInit) => {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': token || '',
        ...options?.headers,
      },
    });
    if (res.status === 401) {
      localStorage.removeItem('portal_token');
      setToken(null);
      setView('login');
      throw new Error('Sessao expirada.');
    }
    return res.json();
  };

  const loadProfile = async () => {
    try {
      const data = await apiPortal('/api/v2/portal/profile');
      setProfile(data);
      setView('dashboard');
    } catch { setView('login'); }
  };

  const loadUpcoming = async () => {
    try {
      const data = await apiPortal('/api/v2/portal/upcoming');
      setUpcoming(data);
    } catch {}
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await apiPortal('/api/v2/portal/history');
      setHistory(data);
      setView('history');
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Preencha email e senha.'); return; }
    try {
      const res = await fetch('/api/v2/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao fazer login.'); return; }
      localStorage.setItem('portal_token', data.token);
      setToken(data.token);
    } catch { setError('Erro de conexao. Tente novamente.'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    setToken(null);
    setProfile(null);
    setUpcoming([]);
    setHistory([]);
    setView('login');
    setEmail('');
    setPassword('');
  };

  const handleSatisfaction = async () => {
    if (!ratedAppointment || rating === 0) return;
    try {
      await apiPortal('/api/v2/portal/satisfaction', {
        method: 'POST',
        body: JSON.stringify({ appointmentId: ratedAppointment, rating, feedback }),
      });
      setSatisfactionMsg('Obrigado pela sua avaliacao!');
      setRating(0);
      setFeedback('');
      setRatedAppointment(null);
    } catch { setError('Erro ao enviar avaliacao.'); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-200">
              <Stethoscope className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">Portal do Paciente</h1>
            <p className="text-sm text-slate-500 mt-1">Acesse seus agendamentos e prontuários</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
            {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-3 font-bold text-sm transition-all shadow-lg shadow-teal-100">
                Entrar
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-6">
              Solicite seu acesso à recepção da clínica
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
            <Stethoscope className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800">Portal do Paciente</span>
            {profile && <p className="text-[10px] text-slate-500 font-medium">Olá, {profile.fullName}</p>}
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-xs font-bold">
          <LogOut size={14} /> Sair
        </button>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { loadUpcoming(); setView('appointments'); }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition-all text-left">
            <Calendar className="text-teal-600 mb-2" size={24} />
            <h3 className="font-bold text-slate-800 text-sm">Agendamentos</h3>
            <p className="text-[10px] text-slate-400">{upcoming.length} proximos</p>
          </button>
          <button onClick={loadHistory} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition-all text-left">
            <FileText className="text-blue-600 mb-2" size={24} />
            <h3 className="font-bold text-slate-800 text-sm">Histórico</h3>
            <p className="text-[10px] text-slate-400">Consultas passadas</p>
          </button>
        </div>

        {/* Upcoming appointments */}
        {view === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-4">Próximos Agendamentos</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum agendamento futuro.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(apt => (
                  <div key={apt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                        <Calendar className="text-teal-600" size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{apt.date}</p>
                        <p className="text-xs text-slate-500">{apt.timeStart} - {apt.type}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                      apt.status === 'confirmado' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                    }`}>{apt.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {view === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-4">Histórico de Consultas</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhuma consulta passada.</p>
            ) : (
              <div className="space-y-3">
                {history.map(apt => (
                  <div key={apt.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{apt.date}</span>
                        <Clock size={14} className="text-slate-400 ml-1" />
                        <span className="text-xs text-slate-500">{apt.timeStart}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase">{apt.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                        apt.recordStatus === 'incluso' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>{apt.recordStatus === 'incluso' ? 'Prontuário disponível' : 'Pendente'}</span>
                      <button
                        onClick={() => { setRatedAppointment(apt.id); setView('satisfaction'); }}
                        className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700"
                      >
                        <Star size={14} /> Avaliar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Satisfaction */}
        {view === 'satisfaction' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-4">Avalie seu Atendimento</h2>
            {satisfactionMsg ? (
              <div className="text-center py-8">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                <p className="text-green-700 font-bold">{satisfactionMsg}</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setRating(n)} className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${
                      n <= rating ? 'bg-amber-400 text-white scale-110' : 'bg-slate-100 text-slate-400 hover:bg-amber-50'
                    }`}>{n}</button>
                  ))}
                </div>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Deixe seu feedback (opcional)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none mb-4" rows={3} />
                <button onClick={handleSatisfaction} disabled={rating === 0} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-30 text-white rounded-xl py-3 font-bold text-sm">
                  Enviar Avaliação
                </button>
              </>
            )}
          </div>
        )}

        {/* Profile info */}
        {profile && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-3">Meus Dados</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><User size={14} className="text-teal-500" /><span className="font-bold">{profile.fullName}</span></div>
              {profile.phone && <div className="flex items-center gap-2 text-slate-500"><Phone size={14} /><span>{profile.phone}</span></div>}
              {profile.email && <div className="flex items-center gap-2 text-slate-500"><Mail size={14} /><span>{profile.email}</span></div>}
              {profile.address?.city && <div className="flex items-center gap-2 text-slate-500"><MapPin size={14} /><span>{profile.address.city}, {profile.address.state}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
