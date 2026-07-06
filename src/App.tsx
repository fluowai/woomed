/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { AgendaSubHeader, AppointmentTable, AgendaCalendar } from './components/Agenda';
import Patients from './components/Patients';
import MedicalRecords from './components/MedicalRecords';
import ChatAssistant from './components/ChatAssistant';
import Dashboard from './components/Dashboard';
import Financeiro from './components/Financeiro';
import Login from './components/Login';
import SetupWizard from './components/SetupWizard';
import ClinicOnboarding from './components/ClinicOnboarding';
import PublicScheduling from './components/PublicScheduling';
import PatientPortal from './components/PatientPortal';
import SaaSAdmin from './components/SaaSAdmin';
import Professionals from './components/Professionals';
import AccessManagement from './components/AccessManagement';
import { WhatsAppConnections, WhatsAppInbox } from './components/WhatsApp';
import ErrorBoundary from './components/ErrorBoundary';
import { MessageSquareText, Plus, Calendar, Clock, User, Stethoscope, Sparkles, LayoutDashboard, TrendingUp, Smartphone, Bot, Users, DollarSign, Megaphone, FileText, Package, BarChart3, ClipboardList, UsersRound, HelpCircle, Zap, Send } from 'lucide-react';
import { lazy, Suspense, useState, useMemo, useEffect, useCallback, ReactNode } from 'react';

// Lazy-loaded expansion modules
const AgentsHub = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.AgentsHub })));
const HelpModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.HelpModule })));
const InteractiveConsultation = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.InteractiveConsultation })));
const InventoryModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.InventoryModule })));
const LlmSettingsModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.LlmSettingsModule })));
const MarketingModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.MarketingModule })));
const NeuralModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.NeuralModule })));
const ReferencesModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.ReferencesModule })));
const ReferralsModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.ReferralsModule })));
const ReportsModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.ReportsModule })));
const TissModule = lazy(() => import('./components/ExpansionModules').then(m => ({ default: m.TissModule })));
const AgentPipelineDashboard = lazy(() => import('./components/AgentModules').then(m => ({ default: m.AgentPipelineDashboard })));
const SdrPipeline = lazy(() => import('./components/AgentModules').then(m => ({ default: m.SdrPipeline })));
const AgentConversations = lazy(() => import('./components/AgentModules').then(m => ({ default: m.AgentConversations })));
const AgentMetricsView = lazy(() => import('./components/AgentModules').then(m => ({ default: m.AgentMetricsView })));
const FollowUpManagement = lazy(() => import('./components/AgentModules').then(m => ({ default: m.FollowUpManagement })));
const CrmModule = lazy(() => import('./components/CrmModule').then(m => ({ default: m.default })));
const NpsLgpdModule = lazy(() => import('./components/NpsLgpdModule').then(m => ({ default: m.default })));
const AutomationModule = lazy(() => import('./components/AutomationModule').then(m => ({ default: m.default })));
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost } from './api';
import { ToastProvider, ToastListener, showToast } from './components/Toast';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { useAuth } from './hooks/useAuth';
import { useClinicData, ClinicDataState, ClinicDataActions } from './hooks/useClinicData';
import { Patient, Doctor, Tenant } from './types';

export type ViewType = string;

const todayDate = () => new Date().toISOString().split('T')[0];

export default function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const auth = useAuth();
  const [data, actions] = useClinicData(auth.authToken);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showClinicOnboarding, setShowClinicOnboarding] = useState(false);
  const [platformReturnToken, setPlatformReturnToken] = useState<string | null>(
    () => localStorage.getItem('consultio_platform_token')
  );

  const loadBootstrap = useCallback(async (token: string) => {
    try {
      const state = await apiGet<any>('/api/bootstrap', token);
      actions.loadBootstrap(state);
      if (state.user.role === 'super_admin' && !state.user.tenantId) {
        setActiveView('Painel SaaS');
      }
      auth.setCurrentUser(state.user);
    } catch (error) {
      localStorage.removeItem('consultio_token');
      auth.setAuthToken(null);
      setBootstrapError(error instanceof Error ? error.message : 'Sessao expirada.');
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  // Bootstrap on mount / token change
  useEffect(() => {
    if (!auth.authToken) {
      fetch('/api/v2/setup/status')
        .then(r => r.json())
        .then(data2 => {
          if (data2.needsSetup) setNeedsSetup(true);
          setIsBootstrapping(false);
        })
        .catch(() => setIsBootstrapping(false));
      return;
    }
    loadBootstrap(auth.authToken);
  }, [auth.authToken]);

  const handleLogin = (token: string, user: any, state: any) => {
    localStorage.setItem('consultio_token', token);
    auth.setAuthToken(token);
    auth.setCurrentUser(user);
    setShowClinicOnboarding(false);
    actions.loadBootstrap(state);
    if (state.user.role === 'super_admin' && !state.user.tenantId) {
      setActiveView('Painel SaaS');
    }
  };

  const handleSetupComplete = async (token: string, user: { id: string; name: string; role: string }) => {
    localStorage.setItem('consultio_token', token);
    auth.setAuthToken(token);
    auth.setCurrentUser(user as any);
    setNeedsSetup(false);
    await loadBootstrap(token);
  };

  const handleLogout = () => {
    auth.handleLogout();
    setPlatformReturnToken(null);
    localStorage.removeItem('consultio_platform_token');
  };

  const handleReturnToPlatform = async () => {
    if (!platformReturnToken) return;
    try {
      const state = await apiGet<any>('/api/bootstrap', platformReturnToken);
      localStorage.setItem('consultio_token', platformReturnToken);
      localStorage.removeItem('consultio_platform_token');
      auth.setAuthToken(platformReturnToken);
      setPlatformReturnToken(null);
      auth.setCurrentUser(state.user);
      actions.loadBootstrap(state);
      setActiveView('Painel SaaS');
      showToast('success', 'Voce voltou ao painel SaaS.');
    } catch (error) {
      localStorage.removeItem('consultio_platform_token');
      setPlatformReturnToken(null);
      showToast('error', error instanceof Error ? error.message : 'Nao foi possivel voltar ao painel SaaS.');
    }
  };;

  const {
    patients, doctors, appointments, medicalRecords,
    financeTransactions, servicePrices, auditEvents,
    serviceAgents, marketingCampaigns, tissGuides,
    inventoryItems, referrals, references, helpTickets,
    llmProviderConfigs, agentTemplates, neuralKnowledge,
    patientDocuments, waitingList, scheduleBlocks,
    medicalTemplates, accountsPayable, paymentGatewayConfig,
    tenants, plans, planFeatures, planLimits,
  } = data;

  const [activeView, setActiveView] = useState<ViewType>(() => searchParams.get('view') || 'Dashboard');
  const [activeSaasSection, setActiveSaasSection] = useState<'overview' | 'tenants' | 'plans' | 'settings'>('overview');
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>(() => todayDate());
  const [viewMode, setViewMode] = useState<'list' | 'month'>('list');
  const [agendaSearch, setAgendaSearch] = useState<string>('');

  // Modal form states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => todayDate());
  const [selectedTime, setSelectedTime] = useState('14:30');
  const [selectedProcedure, setSelectedProcedure] = useState('Consulta Particular');
  
  const [aiSuggestions, setAiSuggestions] = useState<{date: string, time: string, reason: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  const selectedDoctor = useMemo(() => doctors.find(d => d.id === selectedDoctorId), [selectedDoctorId, doctors]);

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const dayName = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  };

  const isSlotFree = (doctorId: string, date: string, timeStart: string, timeEnd: string) => {
    const start = timeToMinutes(timeStart);
    const end = timeToMinutes(timeEnd);
    return !appointments.some(a => {
      if (a.doctorId !== doctorId || a.date !== date || a.status === 'desmarcado') return false;
      const aptStart = timeToMinutes(a.timeStart);
      const aptEnd = timeToMinutes(a.timeEnd);
      return start < aptEnd && end > aptStart;
    });
  };

  const calculateTimeEnd = (timeStart: string) => {
    if (!timeStart) return '';
    const [h, m] = timeStart.split(':').map(Number);
    let newM = m + 30;
    let newH = h;
    if (newM >= 60) {
      newM -= 60;
      newH += 1;
    }
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const checkAvailability = useMemo(() => {
    if (!selectedDoctorId || !selectedDate || !selectedTime) return { hasConflict: false };
    const timeEnd = calculateTimeEnd(selectedTime);
    if (!selectedDoctor || !timeEnd) return { hasConflict: false };
    if (!selectedDoctor.availableDays.includes(dayName(selectedDate))) {
      return { hasConflict: true, reason: 'O profissional nao atende neste dia.' };
    }
    const start = timeToMinutes(selectedTime);
    const end = timeToMinutes(timeEnd);
    if (start < timeToMinutes(selectedDoctor.workingHours.start) || end > timeToMinutes(selectedDoctor.workingHours.end)) {
      return { hasConflict: true, reason: 'Horario fora da grade do profissional.' };
    }
    return { hasConflict: !isSlotFree(selectedDoctorId, selectedDate, selectedTime, timeEnd) };
  }, [selectedDoctorId, selectedDate, selectedTime, appointments, selectedDoctor]);

  // Sync activeView → URL
  const syncView = (view: string) => {
    if (view && view !== 'Dashboard') {
      setSearchParams({ view }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleAddAppointment = async () => {
    if (!selectedPatientId || !selectedDoctorId || !selectedDate || !selectedTime) return;
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;
    try {
      await actions.handleAddAppointment(
        selectedPatientId, selectedDoctorId, selectedDate, selectedTime,
        selectedProcedure || 'Consulta Particular', ''
      );
      setIsSchedulingOpen(false);
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setSelectedDate(todayDate());
      setSelectedTime('14:30');
      setSelectedProcedure('Consulta Particular');
    } catch {}
  };

  const handleStartConsultation = async (id: string, patientName: string) => {
    await actions.handleUpdateAppointmentStatus(id, 'em_atendimento');
    const match = patients.find(p => p.fullName.toUpperCase() === patientName.toUpperCase());
    if (match) setActivePatientId(match.id);
    setActiveView('Prontuários');
  };

  const handleAccessTenant = async (tenant: Tenant) => {
    if (!tenant) return;
    try {
      const response = await apiPost<{ token: string; user: any; state: any }>(
        `/api/v2/saas/tenants/${tenant.id}/access`,
        auth.authToken
      );
      localStorage.setItem('consultio_platform_token', auth.authToken!);
      localStorage.setItem('consultio_token', response.token);
      auth.setAuthToken(response.token);
      auth.setCurrentUser(response.user);
      actions.loadBootstrap(response.state);
      setActiveView('Dashboard');
      showToast('success', `Acessando painel da clinica ${tenant.tradeName}.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao acessar painel da clinica.');
    }
  };

  const handleScheduleForPatient = (patientName: string) => {
    const match = patients.find(p => p.fullName.toUpperCase() === patientName.toUpperCase());
    if (match) setSelectedPatientId(match.id);
    setIsSchedulingOpen(true);
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => a.date === currentDate);
  }, [appointments, currentDate]);

  const localSlotSuggestions = useMemo(() => {
    if (!selectedDoctor || !selectedDate) return [];
    if (!selectedDoctor.availableDays.includes(dayName(selectedDate))) return [];
    const suggestions: { date: string; time: string; reason: string }[] = [];
    const workStart = timeToMinutes(selectedDoctor.workingHours.start);
    const workEnd = timeToMinutes(selectedDoctor.workingHours.end);
    for (let minutes = workStart; minutes + 30 <= workEnd && suggestions.length < 4; minutes += 30) {
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const end = calculateTimeEnd(time);
      if (isSlotFree(selectedDoctor.id, selectedDate, time, end)) {
        suggestions.push({ date: selectedDate, time, reason: 'Horario livre validado' });
      }
    }
    return suggestions;
  }, [selectedDoctor, selectedDate, appointments]);

  // AI Suggestions fetcher
  const fetchAiSuggestions = () => {
    if (!checkAvailability.hasConflict || isAiLoading) return;
    setHasConflict(true);
    const doctor = doctors.find(d => d.id === selectedDoctorId);
    if (!doctor) return;
    setIsAiLoading(true);
    fetch('/api/suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.authToken ? { Authorization: `Bearer ${auth.authToken}` } : {})
      },
      body: JSON.stringify({
        doctor,
        requestedSlot: { date: selectedDate, time: selectedTime },
        currentAppointments: appointments.filter(a => a.doctorId === selectedDoctorId)
      })
    }).then(res => res.json())
      .then(data => { if (Array.isArray(data)) setAiSuggestions(data); })
      .catch(err => console.error(err))
      .finally(() => setIsAiLoading(false));
  };

  // Run AI suggestions when conflict detected
  if (checkAvailability.hasConflict && !hasConflict && !isAiLoading) {
    fetchAiSuggestions();
  }
  if (!checkAvailability.hasConflict && hasConflict) {
    setHasConflict(false);
    setAiSuggestions([]);
  }

  const ModuleWrap = ({ children }: { children: ReactNode }) => (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        {children}
      </Suspense>
    </ErrorBoundary>
  );

  const renderView = () => {
    const featureByView: Record<string, string> = {
      Financeiro: 'financeiro',
      Marketing: 'marketing',
      TISS: 'tiss',
      Estoques: 'estoque',
      'CRM 360': 'crm',
      'Automação': 'automacao',
      'NPS & LGPD': 'nps_lgpd',
      'Central de Agentes': 'ai',
      'Assistente IA': 'ai',
      LLMs: 'ai',
      Neural: 'ai',
      'Pipeline Agentes': 'ai',
      'Pipeline SDR': 'ai',
      'Métricas Agentes': 'ai',
      'Follow-ups': 'ai',
    };
    const requiredFeature = featureByView[activeView];
    if (requiredFeature && planFeatures[requiredFeature] === false) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Modulo indisponivel no plano</h3>
            <p className="text-slate-500 font-medium">Este recurso pode ser liberado alterando o plano da clinica no Painel SaaS.</p>
          </div>
        </div>
      );
    }
    switch (activeView) {
      case 'Dashboard':
        return (
          <Dashboard 
            appointments={appointments}
            patients={patients}
            doctors={doctors}
            currentDate={currentDate}
            onViewChange={setActiveView}
            onNewAppointment={() => setIsSchedulingOpen(true)}
            onNewPatient={() => {
              setActiveView('Pacientes');
              // We could automatically open the modal by dispatching event but opening view is fine.
            }}
          />
        );
      case 'Painel SaaS':
        return (
          <SaaSAdmin
            token={auth.authToken}
            tenants={tenants}
            plans={plans}
            onAccessTenant={handleAccessTenant}
            activeSection={activeSaasSection}
            onRefresh={async () => {
              try {
                const state = await apiGet<any>('/api/bootstrap', auth.authToken);
                if (state.tenants) actions.setTenants(state.tenants);
                if (state.plans) actions.setPlans(state.plans);
              } catch {}
            }}
          />
        );
      case 'Agenda':
        return (
          <>
            <AgendaSubHeader 
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              searchTerm={agendaSearch}
              onSearchChange={setAgendaSearch}
            />
            <div className="flex-1 overflow-hidden relative">
              {viewMode === 'list' ? (
                <AppointmentTable 
                  appointments={filteredAppointments}
                  patients={patients}
                  searchTerm={agendaSearch}
                  onUpdateStatus={actions.handleUpdateAppointmentStatus}
                  onStartConsultation={handleStartConsultation}
                />
              ) : (
                <AgendaCalendar 
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                  appointments={appointments}
                />
              )}
            </div>
          </>
        );
      case 'Pacientes':
        return (
          <Patients 
            patients={patients}
            onAddPatient={actions.handleAddPatient}
            onEditPatient={actions.handleEditPatient}
            onViewMedicalRecord={(id) => {
              setActivePatientId(id);
              setActiveView('Prontuários');
            }}
            onScheduleForPatient={handleScheduleForPatient}
          />
        );
      case 'Profissionais':
        return (
          <Professionals
            doctors={doctors}
            onCreateDoctor={actions.handleCreateDoctor}
            onUpdateDoctor={actions.handleUpdateDoctor}
            onDeleteDoctor={actions.handleDeleteDoctor}
          />
        );
      case 'Acessos':
        return <AccessManagement token={auth.authToken} />;
      case 'Prontuários':
        return (
          <MedicalRecords 
            patients={patients}
            medicalRecords={medicalRecords}
            doctors={doctors}
            onAddMedicalRecordEntry={actions.handleAddMedicalRecordEntry}
            onUpdateMedicalRecordMetadata={actions.handleUpdateMedicalRecordMetadata}
            activePatientId={activePatientId}
            onActivePatientIdChange={setActivePatientId}
          />
        );
      case 'Mensagens':
        return <WhatsAppInbox token={auth.authToken} onOpenConnections={() => setActiveView('Conexoes')} />;
      case 'Conexoes':
        return <WhatsAppConnections token={auth.authToken} />;
      case 'Assistente IA':
        return <ChatAssistant token={auth.authToken} doctors={doctors} appointments={appointments} patients={patients} llmConfigs={llmProviderConfigs} />;
      case 'Central de Agentes':
        return (
          <ModuleWrap>
            <AgentsHub
              agents={serviceAgents}
              templates={agentTemplates}
              onCreateAgent={actions.handleCreateAgent}
              onUpdateAgent={actions.handleUpdateAgent}
              onCreateFromTemplate={actions.handleCreateAgentFromTemplate}
            />
          </ModuleWrap>
        );
      case 'Pipeline Agentes':
        return <ModuleWrap><AgentPipelineDashboard /></ModuleWrap>;
      case 'Pipeline SDR':
        return <ModuleWrap><SdrPipeline /></ModuleWrap>;
      case 'Conversas Agentes':
        return <ModuleWrap><AgentConversations /></ModuleWrap>;
      case 'Métricas Agentes':
        return <ModuleWrap><AgentMetricsView /></ModuleWrap>;
      case 'Follow-ups':
        return <ModuleWrap><FollowUpManagement /></ModuleWrap>;
      case 'LLMs':
        return (
          <ModuleWrap>
            <LlmSettingsModule
              configs={llmProviderConfigs}
              onCreateLlm={actions.handleCreateLlm}
              onUpdateLlm={actions.handleUpdateLlm}
            />
          </ModuleWrap>
        );
      case 'Neural':
        return (
          <ModuleWrap>
            <NeuralModule
              knowledge={neuralKnowledge}
              agents={serviceAgents}
              onCreateKnowledge={actions.handleCreateKnowledge}
              onUpdateKnowledge={actions.handleUpdateKnowledge}
            />
          </ModuleWrap>
        );
      case 'Consulta Interativa':
        return <ModuleWrap><InteractiveConsultation appointments={appointments} patients={patients} doctors={doctors} /></ModuleWrap>;
      case 'Marketing':
        return (
          <ModuleWrap>
            <MarketingModule
              campaigns={marketingCampaigns}
              agents={serviceAgents}
              onCreateCampaign={actions.handleCreateCampaign}
              onUpdateCampaign={actions.handleUpdateCampaign}
            />
          </ModuleWrap>
        );
      case 'TISS':
        return (
          <ModuleWrap>
            <TissModule
              guides={tissGuides}
              appointments={appointments}
              onCreateGuide={actions.handleCreateTissGuide}
              onUpdateGuide={actions.handleUpdateTissGuide}
            />
          </ModuleWrap>
        );
      case 'Estoques':
        return (
          <ModuleWrap>
            <InventoryModule
              items={inventoryItems}
              onCreateItem={actions.handleCreateInventoryItem}
              onUpdateItem={actions.handleUpdateInventoryItem}
            />
          </ModuleWrap>
        );
      case 'Relatórios':
        return (
          <ModuleWrap>
            <ReportsModule
              appointments={appointments}
              patients={patients}
              inventoryItems={inventoryItems}
              campaigns={marketingCampaigns}
              auditEvents={auditEvents}
            />
          </ModuleWrap>
        );
      case 'Indique e ganhe':
        return (
          <ModuleWrap>
            <ReferralsModule
              referrals={referrals}
              patients={patients}
              onCreateReferral={actions.handleCreateReferral}
              onUpdateReferral={actions.handleUpdateReferral}
            />
          </ModuleWrap>
        );
      case 'Referências':
        return <ModuleWrap><ReferencesModule references={references} onCreateReference={actions.handleCreateReference} /></ModuleWrap>;
      case 'CRM 360':
        return <ModuleWrap><CrmModule token={auth.authToken} userRole={auth.currentUser?.role || ''} /></ModuleWrap>;
      case 'NPS & LGPD':
        return <ModuleWrap><NpsLgpdModule token={auth.authToken} userRole={auth.currentUser?.role || ''} /></ModuleWrap>;
      case 'Automação':
        return <ModuleWrap><AutomationModule token={auth.authToken} /></ModuleWrap>;
      case 'Ajuda':
        return (
          <ModuleWrap>
            <HelpModule
              tickets={helpTickets}
              onCreateTicket={actions.handleCreateHelpTicket}
              onUpdateTicket={actions.handleUpdateHelpTicket}
            />
          </ModuleWrap>
        );
      case 'Pipeline Agentes':
        return <AgentPipelineDashboard />;
      case 'Pipeline SDR':
        return <SdrPipeline />;
      case 'Conversas Agentes':
        return <AgentConversations />;
      case 'Métricas Agentes':
        return <AgentMetricsView />;
      case 'Follow-ups':
        return <FollowUpManagement />;
      case 'LLMs':
        return (
          <LlmSettingsModule
            configs={llmProviderConfigs}
            onCreateLlm={actions.handleCreateLlm}
            onUpdateLlm={actions.handleUpdateLlm}
          />
        );
      case 'Neural':
        return (
          <NeuralModule
            knowledge={neuralKnowledge}
            agents={serviceAgents}
            onCreateKnowledge={actions.handleCreateKnowledge}
            onUpdateKnowledge={actions.handleUpdateKnowledge}
          />
        );
      case 'Consulta Interativa':
        return <InteractiveConsultation appointments={appointments} patients={patients} doctors={doctors} />;
      case 'Marketing':
        return (
          <MarketingModule
            campaigns={marketingCampaigns}
            agents={serviceAgents}
            onCreateCampaign={actions.handleCreateCampaign}
            onUpdateCampaign={actions.handleUpdateCampaign}
          />
        );
      case 'Financeiro':
        return (
          <Financeiro 
            appointments={appointments}
            financeTransactions={financeTransactions}
            servicePrices={servicePrices}
            onMarkPaymentPaid={actions.handleMarkPaymentPaid}
            onAddTransaction={actions.handleAddFinanceTransaction}
          />
        );
      case 'TISS':
        return (
          <TissModule
            guides={tissGuides}
            appointments={appointments}
            onCreateGuide={actions.handleCreateTissGuide}
            onUpdateGuide={actions.handleUpdateTissGuide}
          />
        );
      case 'Estoques':
        return (
          <InventoryModule
            items={inventoryItems}
            onCreateItem={actions.handleCreateInventoryItem}
            onUpdateItem={actions.handleUpdateInventoryItem}
          />
        );
      case 'Relatórios':
        return (
          <ReportsModule
            appointments={appointments}
            patients={patients}
            inventoryItems={inventoryItems}
            campaigns={marketingCampaigns}
            auditEvents={auditEvents}
          />
        );
      case 'Indique e ganhe':
        return (
          <ReferralsModule
            referrals={referrals}
            patients={patients}
            onCreateReferral={actions.handleCreateReferral}
            onUpdateReferral={actions.handleUpdateReferral}
          />
        );
      case 'Referências':
        return <ReferencesModule references={references} onCreateReference={actions.handleCreateReference} />;
      case 'CRM 360':
        return <CrmModule token={auth.authToken} userRole={auth.currentUser?.role || ''} />;
      case 'NPS & LGPD':
        return <NpsLgpdModule token={auth.authToken} userRole={auth.currentUser?.role || ''} />;
      case 'Automação':
        return <AutomationModule token={auth.authToken} />;
      case 'Ajuda':
        return (
          <HelpModule
            tickets={helpTickets}
            onCreateTicket={actions.handleCreateHelpTicket}
            onUpdateTicket={actions.handleUpdateHelpTicket}
          />
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
            <div className="text-center p-10 md:p-20 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg">
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{activeView}</h3>
              <p className="text-slate-500 font-medium">Este módulo está em desenvolvimento para o Consultio Med.</p>
            </div>
          </div>
        );
    }
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-600">Carregando ambiente da clínica...</p>
        </div>
      </div>
    );
  }

  if (!auth.authToken || !auth.currentUser) {
    if (needsSetup) {
      if (showClinicOnboarding) {
        return <ClinicOnboarding onBack={() => setShowClinicOnboarding(false)} onComplete={handleLogin} />;
      }
      return <SetupWizard onComplete={handleSetupComplete} onSignup={() => setShowClinicOnboarding(true)} />;
    }
    if (showClinicOnboarding) {
      return <ClinicOnboarding onBack={() => setShowClinicOnboarding(false)} onComplete={handleLogin} />;
    }
    return (
      <>
        {bootstrapError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-rose-50 border border-rose-100 text-rose-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
            {bootstrapError}
          </div>
        )}
        <Login onLogin={handleLogin} onSignup={() => setShowClinicOnboarding(true)} />
      </>
    );
  }

  const isPlatformAdmin = auth.currentUser.role === 'super_admin' && !auth.currentUser.tenantId;
  const mobileSidebarItems = isPlatformAdmin
    ? [{ icon: LayoutDashboard, label: 'Painel SaaS', view: 'Painel SaaS' as ViewType }]
    : [
        { icon: LayoutDashboard, label: 'Dashboard', view: 'Dashboard' as ViewType },
        { icon: Calendar, label: 'Agenda', view: 'Agenda' as ViewType },
        { icon: TrendingUp, label: 'CRM 360', view: 'CRM 360' as ViewType },
        { icon: MessageSquareText, label: 'Mensagens', view: 'Mensagens' as ViewType },
        { icon: Smartphone, label: 'Conexoes', view: 'Conexoes' as ViewType },
        { icon: Bot, label: 'Assistente IA', view: 'Assistente IA' as ViewType },
        { icon: Calendar, label: 'Prontuários', view: 'Prontuários' as ViewType },
        { icon: Users, label: 'Pacientes', view: 'Pacientes' as ViewType },
        { icon: DollarSign, label: 'Financeiro', view: 'Financeiro' as ViewType },
        { icon: Megaphone, label: 'Marketing', view: 'Marketing' as ViewType },
        { icon: FileText, label: 'TISS', view: 'TISS' as ViewType },
        { icon: Package, label: 'Estoques', view: 'Estoques' as ViewType },
        { icon: BarChart3, label: 'Relatórios', view: 'Relatórios' as ViewType },
        { icon: Zap, label: 'Automação', view: 'Automação' as ViewType },
        { icon: ClipboardList, label: 'NPS & LGPD', view: 'NPS & LGPD' as ViewType },
        { icon: UsersRound, label: 'Indique e ganhe', view: 'Indique e ganhe' as ViewType },
        { icon: HelpCircle, label: 'Ajuda', view: 'Ajuda' as ViewType },
        { icon: Send, label: 'Follow-ups', view: 'Follow-ups' as ViewType },
      ];

  return (
    <ToastProvider>
      <ToastListener />
      <PwaInstallPrompt />
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      <Sidebar activeView={activeView} onNewAppointment={() => setIsSchedulingOpen(true)} onViewChange={(view) => {
        setActiveView(view);
        setIsSidebarOpen(false);
      }} userRole={auth.currentUser?.role} userTenantId={auth.currentUser?.tenantId} activeSaasSection={activeSaasSection} onSaasSectionChange={setActiveSaasSection} planFeatures={planFeatures} />
      
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative w-72 bg-white h-full shadow-2xl overflow-y-auto p-4 animate-slide-up">
            <div className="flex items-center gap-3 p-2 mb-4" onClick={() => { setActiveView(isPlatformAdmin ? 'Painel SaaS' : 'Dashboard'); setIsSidebarOpen(false); }}>
              <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-white w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-teal-900 tracking-tight">Consultio Med</span>
            </div>
            <div className="space-y-1">
              {mobileSidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => {
                      setActiveView(item.view);
                      setIsSidebarOpen(false);
                    }}
                    className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? 'text-teal-700 bg-teal-50 font-bold'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <Icon size={20} className={isActive ? 'text-teal-600' : 'text-slate-400'} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden pb-16 lg:pb-0">
        <Header 
          onMenuClick={() => setIsSidebarOpen(true)} 
          activeView={activeView}
          currentDate={currentDate}
          onNewAppointment={() => setIsSchedulingOpen(true)}
          currentUser={auth.currentUser!}
          onLogout={handleLogout}
          onReturnToPlatform={platformReturnToken ? handleReturnToPlatform : undefined}
        />
        
        {renderView()}

        {/* Floating Action Buttons */}
        {!isPlatformAdmin && !['Mensagens', 'Conexoes', 'Assistente IA', 'Conversas Agentes'].includes(activeView) && (
          <div className="fixed bottom-20 right-4 md:bottom-10 md:right-10 flex flex-col gap-3 z-30 lg:bottom-10">
            <button 
              onClick={() => setIsSchedulingOpen(true)}
              className="w-14 h-14 md:w-16 md:h-16 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl shadow-xl shadow-teal-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
              title="Novo Agendamento"
            >
              <Plus size={28} className="group-hover:rotate-90 transition-transform" />
            </button>
            
            <button 
              onClick={() => setActiveView('Assistente IA')}
              className="w-12 h-12 md:w-14 md:h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xl shadow-amber-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
              title="Assistente IA"
            >
              <MessageSquareText size={24} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        )}

        {/* Simplified Scheduling Modal */}
        {!isPlatformAdmin && isSchedulingOpen && (
          <div 
            onClick={() => setIsSchedulingOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full lg:max-w-2xl rounded-t-[32px] lg:rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] lg:max-h-none flex flex-col"
            >
              {/* Drag handle for mobile */}
              <div className="lg:hidden flex justify-center pt-2 pb-0 -mb-1">
                <div className="w-10 h-1.5 rounded-full bg-slate-300" />
              </div>
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Novo Agendamento</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Confirmação em tempo real</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSchedulingOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all font-bold text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  <div className="space-y-6">
                    {/* Patient selection */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={14} className="text-blue-500" />
                        Paciente
                      </label>
                      <select 
                        value={selectedPatientId}
                        onChange={(e) => setSelectedPatientId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none w-full font-bold transition-all"
                      >
                        <option value="">Selecione um paciente...</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                      </select>
                    </div>

                    {/* Doctor selection */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Stethoscope size={14} className="text-indigo-500" />
                        Profissional (Médico)
                      </label>
                      <select 
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-indigo-100 outline-none w-full font-bold transition-all"
                      >
                        <option value="">Selecione o médico...</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name} - {d.specialty}</option>)}
                      </select>
                    </div>

                    {/* Procedure */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Plus size={14} className="text-emerald-500" />
                        Procedimento
                      </label>
                      <select
                        value={selectedProcedure}
                        onChange={(e) => setSelectedProcedure(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-emerald-100 outline-none w-full font-bold transition-all"
                      >
                        {servicePrices.map(price => (
                          <option key={price.id} value={price.name}>{price.name} - R$ {price.value.toFixed(2)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Date */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={14} className="text-blue-500" />
                          Data
                        </label>
                        <input 
                          type="date" 
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all" 
                        />
                      </div>
                      
                      {/* Time */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={14} className="text-blue-500" />
                          Horário
                        </label>
                        <input 
                          type="time" 
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all" 
                        />
                      </div>
                    </div>

                    {selectedDoctor && (
                      <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={14} />
                            {hasConflict ? 'Horário Ocupado — Sugestões IA' : 'Sugestões Disponíveis'}
                          </h4>
                          {isAiLoading && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                        </div>

                        {hasConflict && (
                          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2">
                            <Clock size={14} className="text-rose-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] font-bold text-rose-700 leading-tight">
                              Este horário já está reservado. Escolha uma sugestão livre abaixo.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[180px] p-1">
                          {(hasConflict ? aiSuggestions : localSlotSuggestions).map((s, idx) => (
                            <button 
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedDate(s.date);
                                setSelectedTime(s.time);
                              }}
                              className="flex flex-col p-3 bg-white border border-blue-100 rounded-xl hover:border-blue-500 transition-all group text-left"
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <div className="flex items-center gap-2">
                                  <Calendar size={12} className="text-blue-400" />
                                  <span className="text-xs font-bold text-slate-700">{s.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock size={12} className="text-blue-400" />
                                  <span className="text-xs font-black text-blue-600">{s.time}</span>
                                </div>
                              </div>
                              {s.reason && <span className="text-[9px] text-slate-400 font-medium italic truncate">{s.reason}</span>}
                            </button>
                          ))}
                          {hasConflict && aiSuggestions.length === 0 && !isAiLoading && (
                            <p className="text-xs text-slate-400 text-center py-4 italic">Nenhuma sugestão encontrada pelo assistente.</p>
                          )}
                          {!hasConflict && localSlotSuggestions.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4 italic">Nao ha horarios livres para este profissional nesta data.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
                <div className="p-4 lg:p-8 border-t border-slate-100 bg-white">
                  <button 
                    type="button"
                    onClick={handleAddAppointment}
                    disabled={!selectedPatientId || !selectedDoctorId || !selectedDate || !selectedTime || hasConflict}
                    className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl py-5 font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-teal-100"
                  >
                    {hasConflict ? 'Horário Indisponível' : 'Finalizar Agendamento'}
                  </button>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </ToastProvider>
  );
}
