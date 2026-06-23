import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Building2, CreditCard, Users, Settings, Plus, Search, MoreVertical,
  Activity, CheckCircle2, XCircle, Clock, ShieldCheck, TrendingUp, Zap,
  Edit3, Trash2, X, DollarSign, Smartphone, Bot, Globe, Hash, Tag,
  UserCog, ToggleLeft, ToggleRight, Save, Ban, RefreshCw, Mail, Phone,
  User as UserIcon
} from 'lucide-react';
import { Tenant, SaaSPlan } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import { showToast } from './Toast';

interface SaaSAdminProps {
  token: string | null;
  tenants: Tenant[];
  plans: SaaSPlan[];
  onRefresh: () => void;
}

interface TenantsResponse {
  tenants: Tenant[];
}

interface PlansResponse {
  plans: SaaSPlan[];
}

interface StatsResponse {
  stats: {
    totalTenants: number;
    activeTenants: number;
    trialingTenants: number;
    totalPlans: number;
    totalMRR: number;
    currency: string;
  };
  recentActivity: { title: string; desc: string; time: string }[];
}

export default function SaaSAdmin({ token, tenants, plans, onRefresh }: SaaSAdminProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'plans' | 'settings'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<StatsResponse['stats'] | null>(null);

  // Tenant modal
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState({ slug: '', legalName: '', tradeName: '', document: '', ownerName: '', ownerEmail: '', phone: '', planId: '' });

  // Plan modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [planForm, setPlanForm] = useState({ code: '', name: '', description: '', priceCents: 0, currency: 'BRL', billingInterval: 'month' as 'month' | 'year', users: 1, patients: 100, whatsapp: false, ai: false });

  useMemo(async () => {
    if (token && activeTab === 'overview') {
      try {
        const response = await apiGet<StatsResponse>('/api/v2/saas/stats', token);
        setStats(response.stats);
      } catch { }
    }
  }, [token, activeTab]);

  const filteredTenants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter(t =>
      t.tradeName.toLowerCase().includes(term) ||
      t.slug.toLowerCase().includes(term) ||
      t.legalName.toLowerCase().includes(term)
    );
  }, [tenants, searchTerm]);

  const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'trialing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'past_due': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'suspended': return 'bg-red-100 text-red-700 border-red-200';
      case 'cancelled': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 size={16} />;
      case 'trialing': return <Clock size={16} />;
      case 'suspended': return <XCircle size={16} />;
      default: return <Activity size={16} />;
    }
  };

  // Tenant CRUD
  const openCreateTenant = () => {
    setEditingTenant(null);
    setTenantForm({ slug: '', legalName: '', tradeName: '', document: '', ownerName: '', ownerEmail: '', phone: '', planId: '' });
    setShowTenantModal(true);
  };

  const openEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantForm({
      slug: tenant.slug,
      legalName: tenant.legalName,
      tradeName: tenant.tradeName || '',
      document: tenant.document || '',
      ownerName: tenant.ownerName || '',
      ownerEmail: tenant.ownerEmail || '',
      phone: tenant.phone || '',
      planId: tenant.planId || ''
    });
    setShowTenantModal(true);
  };

  const saveTenant = async () => {
    try {
      if (editingTenant) {
        await apiPatch(`/api/v2/saas/tenants/${editingTenant.id}`, token, {
          slug: tenantForm.slug,
          legalName: tenantForm.legalName,
          tradeName: tenantForm.tradeName,
          document: tenantForm.document,
          ownerName: tenantForm.ownerName,
          ownerEmail: tenantForm.ownerEmail,
          phone: tenantForm.phone,
          planId: tenantForm.planId || undefined
        });
        showToast('success', `Clinica ${tenantForm.tradeName} atualizada.`);
      } else {
        await apiPost('/api/v2/saas/tenants', token, tenantForm);
        showToast('success', `Clinica ${tenantForm.tradeName} criada!`);
      }
      setShowTenantModal(false);
      onRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar clinica.');
    }
  };

  const updateTenantStatus = async (id: string, status: Tenant['status']) => {
    try {
      await apiPatch(`/api/v2/saas/tenants/${id}`, token, { status });
      showToast('success', `Status alterado para ${status}.`);
      onRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao alterar status.');
    }
  };

  const deleteTenant = async (id: string, name: string) => {
    if (!window.confirm(`Remover permanentemente a clinica "${name}"?`)) return;
    try {
      await apiDelete(`/api/v2/saas/tenants/${id}`, token);
      showToast('success', `Clinica ${name} removida.`);
      onRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao remover clinica.');
    }
  };

  // Plan CRUD
  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({ code: '', name: '', description: '', priceCents: 0, currency: 'BRL', billingInterval: 'month', users: 1, patients: 100, whatsapp: false, ai: false });
    setShowPlanModal(true);
  };

  const openEditPlan = (plan: SaaSPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      users: plan.limits.users || 1,
      patients: plan.limits.patients || 100,
      whatsapp: Boolean(plan.features.whatsapp),
      ai: Boolean(plan.features.ai)
    });
    setShowPlanModal(true);
  };

  const savePlan = async () => {
    try {
      const body = {
        code: planForm.code,
        name: planForm.name,
        description: planForm.description,
        priceCents: planForm.priceCents,
        currency: planForm.currency,
        billingInterval: planForm.billingInterval,
        limits: { users: planForm.users, patients: planForm.patients },
        features: { whatsapp: planForm.whatsapp, ai: planForm.ai }
      };
      if (editingPlan) {
        await apiPatch(`/api/v2/saas/plans/${editingPlan.id}`, token, body);
        showToast('success', `Plano ${planForm.name} atualizado.`);
      } else {
        await apiPost('/api/v2/saas/plans', token, body);
        showToast('success', `Plano ${planForm.name} criado!`);
      }
      setShowPlanModal(false);
      onRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar plano.');
    }
  };

  const togglePlanActive = async (plan: SaaSPlan) => {
    try {
      await apiPatch(`/api/v2/saas/plans/${plan.id}`, token, { isActive: !plan.isActive });
      showToast('success', `Plano ${plan.isActive ? 'desativado' : 'ativado'}.`);
      onRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao alterar plano.');
    }
  };

  const deletePlan = async (id: string, name: string) => {
    if (!window.confirm('Remover o plano "' + name + '"? Esta acao desvincula o plano das clinicas.')) return;
    try {
      await apiDelete(`/api/v2/saas/plans/${id}`, token);
      showToast('success', `Plano ${name} removido.`);
      onRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao remover plano.');
    }
  };

  return (
    <div className="flex-1 bg-[#0B0F19] min-h-screen text-slate-200 flex flex-col font-sans overflow-y-auto">
      {/* Header */}
      <div className="relative pt-12 pb-24 px-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 z-0"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_22%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.16),transparent_24%)] opacity-60 mix-blend-overlay z-0"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
        <div className="absolute top-12 -left-24 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40"></div>

        <div className="relative z-10 flex justify-between items-end">
          <div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-300 tracking-tight mb-3">
              Painel de Gestão SaaS
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-blue-200/80 text-lg font-medium max-w-2xl">
              Administração master da plataforma WooMed. Gerencie clínicas, planos e assinaturas.
            </motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="flex gap-4">
            <button onClick={onRefresh} className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)]">
              <RefreshCw size={18} />
              Atualizar
            </button>
            <button onClick={openCreateTenant} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <Plus size={20} />
              Nova Clínica
            </button>
          </motion.div>
        </div>
      </div>

      <div className="px-10 -mt-12 relative z-20 flex-1 pb-12">
        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl w-max mb-8 shadow-2xl">
          {[
            { id: 'overview' as const, label: 'Visão Geral', icon: Activity },
            { id: 'tenants' as const, label: 'Clínicas (Tenants)', icon: Building2 },
            { id: 'plans' as const, label: 'Planos & Preços', icon: CreditCard },
            { id: 'settings' as const, label: 'Configurações', icon: Settings }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeTab === tab.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

          {/* ===== OVERVIEW ===== */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Clínicas', value: tenants.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { label: 'Ativas', value: tenants.filter(t => t.status === 'active').length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Em Trial', value: tenants.filter(t => t.status === 'trialing').length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                  { label: 'Planos', value: plans.length, icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-400/10' }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#131B2C] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full transition-transform group-hover:scale-110"></div>
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <p className="text-slate-400 font-medium mb-1">{stat.label}</p>
                        <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
                      </div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                        <stat.icon size={24} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#131B2C] border border-white/5 rounded-3xl p-8">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <DollarSign className="text-emerald-500" /> Receita Recorrente (MRR)
                  </h3>
                  <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300">
                    {formatCurrency(stats?.totalMRR || 0)}
                  </div>
                  <p className="text-slate-400 mt-2">Baseado nos planos ativos das clínicas</p>
                </div>

                <div className="bg-[#131B2C] border border-white/5 rounded-3xl p-8">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" /> Últimas Atividades
                  </h3>
                  <div className="space-y-4">
                    {tenants.slice(0, 5).map(t => (
                      <div key={t.id} className="flex gap-3 items-start pb-3 border-b border-white/5 last:border-0 last:pb-0">
                        <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 ${t.status === 'active' ? 'text-emerald-500' : 'text-blue-500'}`}>
                          {t.status === 'active' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{t.tradeName}</p>
                          <p className="text-slate-500 text-xs">{t.status === 'active' ? 'Ativo' : 'Em trial'} — {new Date(t.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                    {tenants.length === 0 && <p className="text-slate-500 text-sm">Nenhuma clínica cadastrada.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== TENANTS ===== */}
          {activeTab === 'tenants' && (
            <div className="bg-[#131B2C] border border-white/5 rounded-3xl overflow-hidden">
              <div className="p-6 flex flex-wrap justify-between items-center gap-4 border-b border-white/5">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Buscar clínica..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-500" />
                </div>
                <button onClick={openCreateTenant} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all">
                  <Plus size={18} /> Nova Clínica
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-slate-400 text-sm">
                      <th className="p-5 font-semibold">Clínica</th>
                      <th className="p-5 font-semibold">Status</th>
                      <th className="p-5 font-semibold">Plano</th>
                      <th className="p-5 font-semibold">Contato</th>
                      <th className="p-5 font-semibold">Criação</th>
                      <th className="p-5 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map(tenant => {
                      const plan = plans.find(p => p.id === tenant.planId);
                      return (
                        <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                                {tenant.tradeName.charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-white font-medium">{tenant.tradeName}</h4>
                                <p className="text-slate-500 text-xs mt-0.5">{tenant.slug}.woomed.app</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(tenant.status)}`}>
                              {getStatusIcon(tenant.status)}
                              {tenant.status === 'active' ? 'Ativo' : tenant.status === 'trialing' ? 'Trial' : tenant.status === 'suspended' ? 'Suspenso' : tenant.status === 'cancelled' ? 'Cancelado' : tenant.status}
                            </span>
                          </td>
                          <td className="p-5">
                            <span className="text-slate-300 font-medium bg-white/5 px-3 py-1 rounded-lg border border-white/5 text-sm">
                              {plan?.name || 'Sem plano'}
                            </span>
                          </td>
                          <td className="p-5">
                            <div className="text-sm text-slate-300">
                              {tenant.ownerName && <p className="truncate max-w-[160px]">{tenant.ownerName}</p>}
                              {tenant.ownerEmail && <p className="text-xs text-slate-500 truncate max-w-[160px]">{tenant.ownerEmail}</p>}
                            </div>
                          </td>
                          <td className="p-5 text-slate-400 text-sm">
                            {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditTenant(tenant)} title="Editar" className="p-2 hover:bg-blue-500/20 rounded-lg text-slate-400 hover:text-blue-400 transition-colors">
                                <Edit3 size={16} />
                              </button>
                              {tenant.status === 'active' ? (
                                <button onClick={() => updateTenantStatus(tenant.id, 'suspended')} title="Suspender" className="p-2 hover:bg-amber-500/20 rounded-lg text-slate-400 hover:text-amber-400 transition-colors">
                                  <ToggleLeft size={16} />
                                </button>
                              ) : tenant.status === 'suspended' ? (
                                <button onClick={() => updateTenantStatus(tenant.id, 'active')} title="Ativar" className="p-2 hover:bg-emerald-500/20 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors">
                                  <ToggleRight size={16} />
                                </button>
                              ) : null}
                              <button onClick={() => deleteTenant(tenant.id, tenant.tradeName)} title="Remover" className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTenants.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <Building2 size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Nenhuma clínica encontrada.</p>
                    <button onClick={openCreateTenant} className="mt-4 text-blue-400 hover:text-blue-300 font-medium">Criar primeira clínica</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== PLANS ===== */}
          {activeTab === 'plans' && (
            <div className="space-y-8">
              <div className="flex justify-end">
                <button onClick={openCreatePlan} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all">
                  <Plus size={18} /> Novo Plano
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map(plan => (
                  <div key={plan.id} className={`bg-[#131B2C] border rounded-3xl p-8 relative group transition-all ${plan.isActive ? 'border-white/10 hover:border-blue-500/30' : 'border-white/5 opacity-60'}`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                          <span className="text-xs text-slate-500 font-mono mt-1 block">{plan.code}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditPlan(plan)} title="Editar" className="p-2 hover:bg-blue-500/20 rounded-lg text-slate-400 hover:text-blue-400 transition-colors">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => togglePlanActive(plan)} title={plan.isActive ? 'Desativar' : 'Ativar'} className="p-2 hover:bg-amber-500/20 rounded-lg text-slate-400 hover:text-amber-400 transition-colors">
                            {plan.isActive ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                          </button>
                          <button onClick={() => deletePlan(plan.id, plan.name)} title="Remover" className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm mb-6 h-10">{plan.description}</p>
                      <div className="mb-8">
                        <span className="text-4xl font-extrabold text-white">{formatCurrency(plan.priceCents)}</span>
                        <span className="text-slate-500 font-medium">/{plan.billingInterval === 'year' ? 'ano' : 'mês'}</span>
                      </div>
                      <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-slate-300">
                          <Users size={18} className="text-blue-500 shrink-0" />
                          <span>Até {plan.limits.users} usuário{plan.limits.users !== 1 ? 's' : ''}</span>
                        </li>
                        <li className="flex items-center gap-3 text-slate-300">
                          <UserIcon size={18} className="text-blue-500 shrink-0" />
                          <span>Até {plan.limits.patients} pacientes</span>
                        </li>
                        <li className={`flex items-center gap-3 ${plan.features.whatsapp ? 'text-slate-300' : 'text-slate-600'}`}>
                          <Smartphone size={18} className={plan.features.whatsapp ? 'text-blue-500 shrink-0' : 'text-slate-600 shrink-0'} />
                          <span>WhatsApp {plan.features.whatsapp ? 'Integrado' : 'Indisponível'}</span>
                        </li>
                        <li className={`flex items-center gap-3 ${plan.features.ai ? 'text-slate-300' : 'text-slate-600'}`}>
                          <Bot size={18} className={plan.features.ai ? 'text-blue-500 shrink-0' : 'text-slate-600 shrink-0'} />
                          <span>Agentes de IA {plan.features.ai ? 'Ativos' : 'Indisponíveis'}</span>
                        </li>
                      </ul>
                      <div className="flex gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${plan.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                          {plan.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="text-xs font-bold px-2 py-1 rounded bg-white/5 text-slate-400">
                          Ordem: {plan.sortOrder}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="col-span-full bg-[#131B2C] border border-white/5 rounded-3xl p-16 text-center text-slate-500">
                    <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Nenhum plano cadastrado</p>
                    <p className="text-sm">Crie seu primeiro plano de assinatura.</p>
                    <button onClick={openCreatePlan} className="mt-6 text-blue-400 hover:text-blue-300 font-medium">Criar Plano</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== SETTINGS ===== */}
          {activeTab === 'settings' && (
            <div className="bg-[#131B2C] border border-white/5 rounded-3xl p-8 max-w-3xl">
              <h3 className="text-xl font-bold text-white mb-6">Configurações da Plataforma</h3>
              <div className="space-y-6">
                <div className="pb-6 border-b border-white/5">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2"><Globe size={18} className="text-blue-500" /> Domínios</h4>
                  <p className="text-slate-400 text-sm mb-4">As clínicas usam o subdomínio <code className="text-blue-400 bg-white/5 px-2 py-0.5 rounded">{'{slug}'}.woomed.app</code></p>
                </div>
                <div className="pb-6 border-b border-white/5">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2"><UserCog size={18} className="text-blue-500" /> Usuário Master</h4>
                  <p className="text-slate-400 text-sm mb-4">Você está logado como <strong className="text-white">Super Administrador</strong>. Todos os recursos SaaS estão disponíveis.</p>
                </div>
                <div>
                  <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2"><Ban size={18} /> Zona de Perigo</h4>
                  <p className="text-slate-400 text-sm mb-4">Ações destrutivas que afetam todos os inquilinos.</p>
                  <button onClick={() => { if (window.confirm('Tem certeza? Esta acao nao pode ser desfeita.')) { showToast('info', 'Modo de manutencao global ativado (simulado).'); } }}
                    className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Modo de Manutenção Global
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ===== TENANT MODAL ===== */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowTenantModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#131B2C] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="text-blue-400" size={22} />
                <h3 className="text-lg font-bold text-white">{editingTenant ? 'Editar Clínica' : 'Nova Clínica'}</h3>
              </div>
              <button onClick={() => setShowTenantModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Slug (subdomínio)</label>
                  <div className="flex items-center gap-2">
                    <input value={tenantForm.slug} onChange={e => setTenantForm(f => ({ ...f, slug: e.target.value }))}
                      className="flex-1 bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                      placeholder="minha-clinica" />
                    <span className="text-slate-500 text-sm">.woomed.app</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Razão Social</label>
                  <input value={tenantForm.legalName} onChange={e => setTenantForm(f => ({ ...f, legalName: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="Clinica Exemplo Ltda" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Nome Fantasia</label>
                  <input value={tenantForm.tradeName} onChange={e => setTenantForm(f => ({ ...f, tradeName: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="Clinica Exemplo" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">CNPJ/CPF</label>
                  <input value={tenantForm.document} onChange={e => setTenantForm(f => ({ ...f, document: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Plano</label>
                  <select value={tenantForm.planId} onChange={e => setTenantForm(f => ({ ...f, planId: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sem plano</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.priceCents)}/mês</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Proprietário</label>
                  <input value={tenantForm.ownerName} onChange={e => setTenantForm(f => ({ ...f, ownerName: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="Nome do dono" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Email</label>
                  <input value={tenantForm.ownerEmail} onChange={e => setTenantForm(f => ({ ...f, ownerEmail: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="dono@clinica.com" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Telefone</label>
                  <input value={tenantForm.phone} onChange={e => setTenantForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="+5548988003260" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/5 flex justify-end gap-3">
              <button onClick={() => setShowTenantModal(false)} className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button onClick={saveTenant} disabled={!tenantForm.slug || !tenantForm.legalName}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center gap-2">
                <Save size={16} />
                {editingTenant ? 'Atualizar' : 'Criar Clínica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PLAN MODAL ===== */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowPlanModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#131B2C] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="text-blue-400" size={22} />
                <h3 className="text-lg font-bold text-white">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Código</label>
                  <input value={planForm.code} onChange={e => setPlanForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="BASIC" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Nome</label>
                  <input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="Básico" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Descrição</label>
                  <input value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                    placeholder="Plano ideal para pequenas clinicas" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Preço (centavos)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                    <input type="number" value={planForm.priceCents / 100} onChange={e => setPlanForm(f => ({ ...f, priceCents: Math.round(Number(e.target.value) * 100) }))}
                      className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Ciclo</label>
                  <select value={planForm.billingInterval} onChange={e => setPlanForm(f => ({ ...f, billingInterval: e.target.value as 'month' | 'year' }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="month">Mensal</option>
                    <option value="year">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Limite de Usuários</label>
                  <input type="number" value={planForm.users} onChange={e => setPlanForm(f => ({ ...f, users: Number(e.target.value) }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Limite de Pacientes</label>
                  <input type="number" value={planForm.patients} onChange={e => setPlanForm(f => ({ ...f, patients: Number(e.target.value) }))}
                    className="w-full bg-[#0B0F19] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2 space-y-3">
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Recursos</label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={planForm.whatsapp} onChange={e => setPlanForm(f => ({ ...f, whatsapp: e.target.checked }))}
                      className="w-4 h-4 rounded bg-[#0B0F19] border border-white/20 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-300 flex items-center gap-2"><Smartphone size={16} /> WhatsApp Integrado</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={planForm.ai} onChange={e => setPlanForm(f => ({ ...f, ai: e.target.checked }))}
                      className="w-4 h-4 rounded bg-[#0B0F19] border border-white/20 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-300 flex items-center gap-2"><Bot size={16} /> Agentes de IA</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/5 flex justify-end gap-3">
              <button onClick={() => setShowPlanModal(false)} className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button onClick={savePlan} disabled={!planForm.code || !planForm.name}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center gap-2">
                <Save size={16} />
                {editingPlan ? 'Atualizar' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
