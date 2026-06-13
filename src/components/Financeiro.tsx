import { ReactNode, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Plus,
  Search,
  TrendingUp,
  X
} from 'lucide-react';
import { Appointment, FinanceTransaction, ServicePrice } from '../types';

interface FinanceProps {
  appointments: Appointment[];
  financeTransactions: FinanceTransaction[];
  servicePrices: ServicePrice[];
  onMarkPaymentPaid: (appointmentId: string) => void;
  onAddTransaction: (transaction: Omit<FinanceTransaction, 'id' | 'date' | 'status' | 'source'>) => void;
}

export default function Financeiro({
  appointments,
  financeTransactions,
  servicePrices,
  onMarkPaymentPaid,
  onAddTransaction
}: FinanceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [val, setVal] = useState('');
  const [cat, setCat] = useState('Despesa Operacional');
  const [tType, setTType] = useState<'receita' | 'despesa'>('despesa');

  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const getServicePrice = (type: string) => {
    const normalizedType = normalize(type);
    return servicePrices.find(price => {
      const normalizedName = normalize(price.name);
      return normalizedType.includes(normalizedName) || normalizedName.includes(normalizedType);
    });
  };

  const appointmentTransactions: FinanceTransaction[] = useMemo(() => {
    return appointments
      .map(apt => {
        const price = apt.status === 'desmarcado' ? undefined : getServicePrice(apt.type);
        const value = price?.value || 0;
        return {
          id: `apt-${apt.id}`,
          date: apt.date,
          description: `Consulta - ${apt.patientName}`,
          value,
          category: price?.category || 'Procedimentos Clinicos',
          type: 'receita' as const,
          status: apt.paymentStatus === 'paid' ? 'concluido' as const : 'pendente' as const,
          source: 'appointment' as const,
          appointmentId: apt.id
        };
      })
      .filter(transaction => transaction.value > 0);
  }, [appointments, servicePrices]);

  const allTransactions = [...appointmentTransactions, ...financeTransactions];

  const filteredTransactions = allTransactions
    .filter(transaction =>
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalReceitasConcluidas = allTransactions
    .filter(transaction => transaction.type === 'receita' && transaction.status === 'concluido')
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalReceitasPendentes = allTransactions
    .filter(transaction => transaction.type === 'receita' && transaction.status === 'pendente')
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalDespesas = allTransactions
    .filter(transaction => transaction.type === 'despesa')
    .reduce((acc, curr) => acc + curr.value, 0);

  const saldoCaixa = totalReceitasConcluidas - totalDespesas;
  const pendingAppointments = appointments.filter(apt => apt.paymentStatus === 'pending' && apt.status !== 'desmarcado');

  const handleAddTransaction = () => {
    if (!desc || !val) return;
    onAddTransaction({
      description: desc,
      value: Number(val),
      category: cat,
      type: tType
    });
    setIsModalOpen(false);
    setDesc('');
    setVal('');
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financeiro & Faturamento</h2>
          <p className="text-sm text-slate-500 font-medium">Controle de caixa, receitas, despesas e recebimentos.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
        >
          <Plus size={20} />
          <span>Lancar Receita/Despesa</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <SummaryCard label="Saldo em Caixa" value={saldoCaixa} tone={saldoCaixa >= 0 ? 'green' : 'rose'} icon={<DollarSign size={24} />} hint="Receitas recebidas - despesas" />
        <SummaryCard label="Recebido" value={totalReceitasConcluidas} tone="green" icon={<CheckCircle size={24} />} hint="Entradas confirmadas" trend={<ArrowUpRight size={12} />} />
        <SummaryCard label="Contas a Receber" value={totalReceitasPendentes} tone="blue" icon={<Clock size={24} />} hint="Consultas pendentes" trend={<Clock size={12} />} />
        <SummaryCard label="Total Despesas" value={totalDespesas} tone="rose" icon={<TrendingUp size={24} className="rotate-180" />} hint="Custos da clinica" trend={<ArrowDownRight size={12} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 tracking-tight">Extrato Financeiro</h3>
                <p className="text-xs text-slate-400 font-medium">Receitas de consultas e lancamentos manuais</p>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar transacoes..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Descricao</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTransactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-400">{transaction.date}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 uppercase tracking-tight">{transaction.description}</td>
                      <td className="px-6 py-4 text-slate-500">{transaction.category}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase ${
                          transaction.type === 'receita' ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-black ${
                        transaction.type === 'receita' ? 'text-green-600' : 'text-rose-600'
                      }`}>
                        {transaction.type === 'receita' ? '+' : '-'} R$ {transaction.value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[9px] uppercase ${
                          transaction.status === 'concluido' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {transaction.status === 'concluido' ? 'Confirmado' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 italic">
                        Nenhuma transacao financeira encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm flex flex-col">
            <div className="mb-4">
              <h3 className="font-black text-slate-800 tracking-tight">Cobrancas Pendentes</h3>
              <p className="text-xs text-slate-400 font-medium">Marque como pago apos receber do paciente</p>
            </div>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {pendingAppointments.map(apt => {
                const value = getServicePrice(apt.type)?.value || 0;
                return (
                  <div key={apt.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-black text-slate-800 uppercase block tracking-tight">{apt.patientName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">{apt.type}</span>
                      </div>
                      <span className="text-xs font-black text-blue-600 font-mono">R$ {value.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                      <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
                        <Calendar size={10} /> {apt.date} as {apt.timeStart}
                      </span>
                      <button
                        onClick={() => onMarkPaymentPaid(apt.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm active:scale-95"
                      >
                        Confirmar Recebimento
                      </button>
                    </div>
                  </div>
                );
              })}

              {pendingAppointments.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  Nao ha cobrancas pendentes no momento.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
            <h3 className="font-black text-slate-800 tracking-tight mb-4">Tabela de Precos</h3>
            <div className="space-y-3">
              {servicePrices.map(price => (
                <div key={price.id} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-600">{price.name}</span>
                  <span className="font-black text-slate-900">R$ {price.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Novo Lancamento Financeiro</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Lancamento</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTType('despesa')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      tType === 'despesa' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTType('receita')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      tType === 'receita' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descricao</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(event) => setDesc(event.target.value)}
                  placeholder="Ex: Conta de luz, compra de luvas..."
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor (R$)</label>
                  <input
                    type="number"
                    value={val}
                    onChange={(event) => setVal(event.target.value)}
                    placeholder="0.00"
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                  <select
                    value={cat}
                    onChange={(event) => setCat(event.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold appearance-none w-full"
                  >
                    <option value="Despesa Operacional">Operacional</option>
                    <option value="Insumos">Insumos/Material</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Honorarios">Honorarios</option>
                    <option value="Extra">Extra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 w-full gap-3 pt-4">
                <button
                  onClick={handleAddTransaction}
                  disabled={!desc || !val}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
                >
                  Confirmar Lancamento
                </button>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white border border-slate-200 text-slate-600 rounded-2xl py-4 font-bold hover:bg-slate-50 transition-all text-xs uppercase"
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

interface SummaryCardProps {
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'rose';
  icon: ReactNode;
  hint: string;
  trend?: ReactNode;
}

function SummaryCard({ label, value, tone, icon, hint, trend }: SummaryCardProps) {
  const toneClasses = {
    green: 'text-green-600 bg-green-50',
    blue: 'text-blue-600 bg-blue-50',
    rose: 'text-rose-600 bg-rose-50'
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="space-y-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</span>
        <span className={`text-2xl font-black ${tone === 'green' ? 'text-green-700' : tone === 'blue' ? 'text-blue-600' : 'text-rose-600'}`}>
          R$ {value.toFixed(2)}
        </span>
        <span className={`text-[10px] font-bold flex items-center gap-1 ${tone === 'green' ? 'text-green-600' : tone === 'blue' ? 'text-blue-500' : 'text-rose-500'}`}>
          {trend} {hint}
        </span>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${toneClasses[tone]}`}>
        {icon}
      </div>
    </div>
  );
}
