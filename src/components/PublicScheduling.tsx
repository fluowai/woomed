import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Stethoscope, CheckCircle, ArrowLeft, Phone, Mail, ChevronRight } from 'lucide-react';

interface PublicDoctor {
  id: string;
  name: string;
  specialty: string;
  availableDays: string[];
  workingHours: { start: string; end: string };
}

interface TimeSlot {
  time: string;
  available: boolean;
}

type Step = 'doctor' | 'date' | 'time' | 'info' | 'confirm';

export default function PublicScheduling() {
  const [step, setStep] = useState<Step>('doctor');
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<PublicDoctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [procedure, setProcedure] = useState('Consulta Particular');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<{ doctorName: string; date: string; time: string; token: string } | null>(null);

  useEffect(() => {
    fetch('/api/v2/public/doctors')
      .then(r => r.json())
      .then(setDoctors)
      .catch(() => setError('Erro ao carregar profissionais.'));
  }, []);

  const todayDate = () => new Date().toISOString().split('T')[0];

  const loadSlots = async (doctorId: string, date: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v2/public/slots?doctorId=${doctorId}&date=${date}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch { setError('Erro ao carregar horarios.'); }
    finally { setLoading(false); }
  };

  const handleSelectDoctor = (doctor: PublicDoctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedTime('');
    setSlots([]);
    setStep('date');
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
    if (selectedDoctor) loadSlots(selectedDoctor.id, date);
    setStep('time');
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setStep('info');
  };

  const handleSubmit = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime || !patientName) {
      setError('Preencha todos os campos obrigatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v2/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          date: selectedDate,
          timeStart: selectedTime,
          patientName,
          patientPhone,
          patientEmail,
          procedure,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setConfirmation({
        doctorName: selectedDoctor.name,
        date: selectedDate,
        time: selectedTime,
        token: data.confirmationToken,
      });
      setStep('confirm');
    } catch { setError('Erro ao confirmar agendamento.'); }
    finally { setLoading(false); }
  };

  if (confirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Agendamento Confirmado!</h2>
          <div className="bg-teal-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm"><span className="font-bold text-slate-600">Dr(a):</span> {confirmation.doctorName}</p>
            <p className="text-sm"><span className="font-bold text-slate-600">Data:</span> {confirmation.date}</p>
            <p className="text-sm"><span className="font-bold text-slate-600">Horário:</span> {confirmation.time}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Seu código de confirmação</p>
            <p className="text-2xl font-black text-amber-800 tracking-widest">{confirmation.token}</p>
            <p className="text-[10px] text-amber-600 mt-1">Guarde este código para cancelar ou consultar seu agendamento.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <Stethoscope className="text-white w-5 h-5" />
        </div>
        <span className="text-sm font-bold text-slate-800">Agendamento Online</span>
      </header>

      <div className="max-w-lg mx-auto p-4">
        {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">{error}</div>}

        {/* Step progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {['doctor', 'date', 'time', 'info'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-teal-600 text-white' : ['doctor', 'date', 'time', 'info'].indexOf(step) > i ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'
              }`}>{i + 1}</div>
              {i < 3 && <div className="w-8 h-0.5 bg-slate-200" />}
            </div>
          ))}
        </div>

        {step === 'doctor' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Selecione o Profissional</h2>
            {doctors.map(d => (
              <button key={d.id} onClick={() => handleSelectDoctor(d)} className="w-full bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition-all text-left flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                  <User className="text-teal-600" size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.specialty}</p>
                </div>
                <ChevronRight className="text-slate-300 ml-auto" size={20} />
              </button>
            ))}
          </div>
        )}

        {step === 'date' && selectedDoctor && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Selecione a Data</h2>
            <input type="date" value={selectedDate} onChange={e => handleSelectDate(e.target.value)} min={todayDate()} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            <button onClick={() => setStep('doctor')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600"><ArrowLeft size={14} /> Voltar</button>
          </div>
        )}

        {step === 'time' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Selecione o Horário</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.filter(s => s.available).map(s => (
                  <button key={s.time} onClick={() => handleSelectTime(s.time)} className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                    selectedTime === s.time ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'
                  }`}>{s.time}</button>
                ))}
              </div>
            )}
            {slots.filter(s => s.available).length === 0 && !loading && (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum horário disponível nesta data.</p>
            )}
            <button onClick={() => setStep('date')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600"><ArrowLeft size={14} /> Voltar</button>
          </div>
        )}

        {step === 'info' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Seus Dados</h2>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome completo *</label>
              <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Telefone</label>
              <input type="tel" value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email</label>
              <input type="email" value={patientEmail} onChange={e => setPatientEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <button onClick={handleSubmit} disabled={loading || !patientName} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-30 text-white rounded-xl py-4 font-bold text-sm transition-all shadow-lg shadow-teal-100">
              {loading ? 'Confirmando...' : 'Confirmar Agendamento'}
            </button>
            <button onClick={() => setStep('time')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600"><ArrowLeft size={14} /> Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}
