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
import SaaSAdmin from './components/SaaSAdmin';
import { WhatsAppConnections, WhatsAppInbox } from './components/WhatsApp';
import {
  AgentsHub,
  HelpModule,
  InteractiveConsultation,
  InventoryModule,
  LlmSettingsModule,
  MarketingModule,
  NeuralModule,
  ReferencesModule,
  ReferralsModule,
  ReportsModule,
  TissModule
} from './components/ExpansionModules';
import { AgentPipelineDashboard, SdrPipeline, AgentConversations, AgentMetricsView, FollowUpManagement } from './components/AgentModules';
import CrmModule from './components/CrmModule';
import NpsLgpdModule from './components/NpsLgpdModule';
import AutomationModule from './components/AutomationModule';
import { MessageSquareText, Plus, Calendar, Clock, User, Stethoscope, Sparkles, LayoutDashboard, TrendingUp, Smartphone, Bot, Users, DollarSign, Megaphone, FileText, Package, BarChart3, ClipboardList, UsersRound, HelpCircle, Zap, Send } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { apiGet, apiPatch, apiPost, apiPut, apiDelete, BootstrapState } from './api';
import { ToastProvider, ToastListener, showToast } from './components/Toast';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import {
  AccountsPayable,
  AppUser,
  Patient, 
  Appointment, 
  MedicalRecord, 
  MedicalRecordEntry, 
  AppointmentStatus,
  Doctor,
  FinanceTransaction,
  ServicePrice,
  AuditEvent,
  ServiceAgent,
  MarketingCampaign,
  TissGuide,
  InventoryItem,
  ReferralRecord,
  ReferenceMaterial,
  HelpTicket,
  LlmProviderConfig,
  AgentTemplate,
  MedicalTemplate,
  NeuralKnowledgeItem,
  PatientDocument,
  PaymentGatewayConfig,
  ScheduleBlock,
  WaitingListEntry,
  Tenant,
  SaaSPlan,
  CrmLead, CrmPipeline, CrmOpportunity, CrmTask, CrmInteraction, LeadSource,
  NpsSurvey, NpsResponse,
  AutomationTemplate, AutomationReminder,
  LgpdConsentTemplate, LgpdPatientConsent, LgpdDataSubjectRequest, LgpdSensitiveAccessLog,
  ProfessionalUnit, ProfessionalRoom,
  PatientPortalLogin, PatientSatisfactionRating
} from './types';
import { DEFAULT_AGENT_TEMPLATES, DEFAULT_LLM_PROVIDER_CONFIGS, DEFAULT_NEURAL_KNOWLEDGE } from './aiCatalog';

export type ViewType = string;

const todayDate = () => new Date().toISOString().split('T')[0];

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('consultio_token'));
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showClinicOnboarding, setShowClinicOnboarding] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('Dashboard');
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Dynamic States
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<Record<string, MedicalRecord>>({});
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [serviceAgents, setServiceAgents] = useState<ServiceAgent[]>([]);
  const [marketingCampaigns, setMarketingCampaigns] = useState<MarketingCampaign[]>([]);
  const [tissGuides, setTissGuides] = useState<TissGuide[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [references, setReferences] = useState<ReferenceMaterial[]>([]);
  const [helpTickets, setHelpTickets] = useState<HelpTicket[]>([]);
  const [llmProviderConfigs, setLlmProviderConfigs] = useState<LlmProviderConfig[]>([]);
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([]);
  const [neuralKnowledge, setNeuralKnowledge] = useState<NeuralKnowledgeItem[]>([]);
  const [patientDocuments, setPatientDocuments] = useState<PatientDocument[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [medicalTemplates, setMedicalTemplates] = useState<MedicalTemplate[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<AccountsPayable[]>([]);
  const [paymentGatewayConfig, setPaymentGatewayConfig] = useState<PaymentGatewayConfig[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [crmPipelines, setCrmPipelines] = useState<CrmPipeline[]>([]);
  const [crmOpportunities, setCrmOpportunities] = useState<CrmOpportunity[]>([]);
  const [crmTasks, setCrmTasks] = useState<CrmTask[]>([]);
  const [crmInteractions, setCrmInteractions] = useState<CrmInteraction[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [npsSurveys, setNpsSurveys] = useState<NpsSurvey[]>([]);
  const [npsResponses, setNpsResponses] = useState<NpsResponse[]>([]);
  const [automationTemplates, setAutomationTemplates] = useState<AutomationTemplate[]>([]);
  const [automationReminders, setAutomationReminders] = useState<AutomationReminder[]>([]);
  const [lgpdConsentTemplates, setLgpdConsentTemplates] = useState<LgpdConsentTemplate[]>([]);
  const [lgpdPatientConsents, setLgpdPatientConsents] = useState<LgpdPatientConsent[]>([]);
  const [lgpdDataSubjectRequests, setLgpdDataSubjectRequests] = useState<LgpdDataSubjectRequest[]>([]);
  const [lgpdSensitiveAccessLogs, setLgpdSensitiveAccessLogs] = useState<LgpdSensitiveAccessLog[]>([]);
  const [professionalUnits, setProfessionalUnits] = useState<ProfessionalUnit[]>([]);
  const [professionalRooms, setProfessionalRooms] = useState<ProfessionalRoom[]>([]);
  const [patientPortalLogins, setPatientPortalLogins] = useState<PatientPortalLogin[]>([]);
  const [patientSatisfactionRatings, setPatientSatisfactionRatings] = useState<PatientSatisfactionRating[]>([]);
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
  
  // Selected Patient inside Medical Records View
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  const applyBootstrapState = (state: BootstrapState) => {
    setCurrentUser(state.user);
    setPatients(state.patients);
    setDoctors(state.doctors);
    setAppointments(state.appointments);
    setMedicalRecords(state.medicalRecords);
    setFinanceTransactions(state.financeTransactions);
    setServicePrices(state.servicePrices);
    setAuditEvents(state.auditEvents);
    setServiceAgents(state.serviceAgents);
    setMarketingCampaigns(state.marketingCampaigns);
    setTissGuides(state.tissGuides);
    setInventoryItems(state.inventoryItems);
    setReferrals(state.referrals);
    setReferences(state.references);
    setHelpTickets(state.helpTickets);
    setLlmProviderConfigs(state.llmProviderConfigs || DEFAULT_LLM_PROVIDER_CONFIGS);
    setAgentTemplates(state.agentTemplates || DEFAULT_AGENT_TEMPLATES);
    setNeuralKnowledge(state.neuralKnowledge || DEFAULT_NEURAL_KNOWLEDGE);
    setPatientDocuments(state.patientDocuments || []);
    setWaitingList(state.waitingList || []);
    setScheduleBlocks(state.scheduleBlocks || []);
    setMedicalTemplates(state.medicalTemplates || []);
    setAccountsPayable(state.accountsPayable || []);
    setPaymentGatewayConfig(state.paymentGatewayConfig || []);
    setTenants(state.tenants || []);
    setPlans(state.plans || []);
    setCrmLeads(state.crmLeads || []);
    setCrmPipelines(state.crmPipelines || []);
    setCrmOpportunities(state.crmOpportunities || []);
    setCrmTasks(state.crmTasks || []);
    setCrmInteractions(state.crmInteractions || []);
    setLeadSources(state.leadSources || []);
    setNpsSurveys(state.npsSurveys || []);
    setNpsResponses(state.npsResponses || []);
    setAutomationTemplates(state.automationTemplates || []);
    setAutomationReminders(state.automationReminders || []);
    setLgpdConsentTemplates(state.lgpdConsentTemplates || []);
    setLgpdPatientConsents(state.lgpdPatientConsents || []);
    setLgpdDataSubjectRequests(state.lgpdDataSubjectRequests || []);
    setLgpdSensitiveAccessLogs(state.lgpdSensitiveAccessLogs || []);
    setProfessionalUnits(state.professionalUnits || []);
    setProfessionalRooms(state.professionalRooms || []);
    setPatientPortalLogins(state.patientPortalLogins || []);
    setPatientSatisfactionRatings(state.patientSatisfactionRatings || []);
  };

  useEffect(() => {
    if (!authToken) {
      fetch('/api/v2/setup/status')
        .then(r => r.json())
        .then(data => {
          if (data.needsSetup) {
            setNeedsSetup(true);
            setIsBootstrapping(false);
          } else {
            setIsBootstrapping(false);
          }
        })
        .catch(() => setIsBootstrapping(false));
      return;
    }

    apiGet<BootstrapState>('/api/bootstrap', authToken)
      .then(applyBootstrapState)
      .catch((error) => {
        localStorage.removeItem('consultio_token');
        setAuthToken(null);
        setBootstrapError(error instanceof Error ? error.message : 'Sessao expirada.');
      })
      .finally(() => setIsBootstrapping(false));
  }, [authToken]);

  const handleLogin = (token: string, user: AppUser, state: BootstrapState) => {
    localStorage.setItem('consultio_token', token);
    setAuthToken(token);
    setCurrentUser(user);
    setShowClinicOnboarding(false);
    applyBootstrapState(state);
  };

  const handleSetupComplete = async (token: string, user: { id: string; name: string; role: string }) => {
    localStorage.setItem('consultio_token', token);
    setAuthToken(token);
    setCurrentUser(user as AppUser);
    setNeedsSetup(false);
    try {
      const state = await apiGet<BootstrapState>('/api/bootstrap', token);
      applyBootstrapState(state);
    } catch { }
  };

  const handleLogout = () => {
    if (authToken) {
      apiPost('/api/auth/logout', authToken).catch(() => undefined);
    }
    localStorage.removeItem('consultio_token');
    setAuthToken(null);
    setCurrentUser(null);
    setActiveView('Dashboard');
  };

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

  // Calculate standard 30 min consult duration block
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

  // Conflict verification
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

  // AI Suggestions fetcher
  useEffect(() => {
    if (checkAvailability.hasConflict && !isAiLoading) {
      setHasConflict(true);
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      if (doctor) {
        setIsAiLoading(true);
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({
            doctor,
            requestedSlot: { date: selectedDate, time: selectedTime },
            currentAppointments: appointments.filter(a => a.doctorId === selectedDoctorId)
          })
        }).then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setAiSuggestions(data);
          })
          .catch(err => console.error('Error fetching suggestions:', err))
          .finally(() => setIsAiLoading(false));
      }
    } else if (!checkAvailability.hasConflict) {
      setHasConflict(false);
      setAiSuggestions([]);
    }
  }, [checkAvailability.hasConflict, selectedDoctorId, selectedDate, selectedTime, appointments, doctors, authToken]);

  // State manipulation handlers
  const handleAddAppointment = async () => {
    if (!selectedPatientId || !selectedDoctorId || !selectedDate || !selectedTime) return;

    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    try {
      const response = await apiPost<{ appointment: Appointment }>('/api/appointments', authToken, {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        date: selectedDate,
        timeStart: selectedTime,
        type: selectedProcedure || 'Consulta Particular',
        observations: ''
      });

      setAppointments(prev => [...prev, response.appointment]);
      setIsSchedulingOpen(false);

      setSelectedPatientId('');
      setSelectedDoctorId('');
      setSelectedDate(todayDate());
      setSelectedTime('14:30');
      setSelectedProcedure('Consulta Particular');

      showToast('success', `Agendamento de ${patient.fullName} cadastrado com sucesso!`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar agendamento.');
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      const response = await apiPatch<{ appointment: Appointment }>(`/api/appointments/${id}/status`, authToken, { status: newStatus });
      setAppointments(prev => prev.map(a => a.id === id ? response.appointment : a));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar status.');
    }
  };

  const handleStartConsultation = async (id: string, patientName: string) => {
    // 1. Update status to em_atendimento
    await handleUpdateAppointmentStatus(id, 'em_atendimento');
    
    // 2. Lookup patient id
    const match = patients.find(p => p.fullName.toUpperCase() === patientName.toUpperCase());
    if (match) {
      setActivePatientId(match.id);
    }
    
    // 3. Switch view to Prontuários
    setActiveView('Prontuários');
  };

  const handleAddPatient = async (newPatient: Patient) => {
    try {
      const response = await apiPost<{ patient: Patient; medicalRecord: MedicalRecord }>('/api/patients', authToken, newPatient);
      setPatients(prev => [...prev, response.patient]);
      setMedicalRecords(prev => ({
        ...prev,
        [response.patient.id]: response.medicalRecord
      }));
      showToast('success', `Paciente ${response.patient.fullName} cadastrado e prontuário inicializado!`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar paciente.');
    }
  };

  const handleEditPatient = async (editedPatient: Patient) => {
    try {
      const response = await apiPut<{ patient: Patient; appointments: Appointment[] }>(`/api/patients/${editedPatient.id}`, authToken, editedPatient);
      setPatients(prev => prev.map(p => p.id === response.patient.id ? response.patient : p));
      setAppointments(response.appointments);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao editar paciente.');
    }
  };

  const handleAddMedicalRecordEntry = async (patientId: string, entry: MedicalRecordEntry) => {
    try {
      const response = await apiPost<{ entry: MedicalRecordEntry; medicalRecord: MedicalRecord; appointments: Appointment[] }>(
        `/api/medical-records/${patientId}/entries`,
        authToken,
        { ...entry, date: currentDate }
      );
      setMedicalRecords(prev => ({
        ...prev,
        [patientId]: response.medicalRecord
      }));
      setAppointments(response.appointments);
      showToast('success', 'Evolução clínica gravada com sucesso no prontuário eletrônico!');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao gravar evolução clínica.');
    }
  };

  const handleUpdateMedicalRecordMetadata = (
    patientId: string, 
    metadata: { 
      bloodType: string; 
      allergies: string[]; 
      medications: string[]; 
      chronicDiseases: string[];
      gender: string;
    }
  ) => {
    apiPatch<{ medicalRecord: MedicalRecord }>(`/api/medical-records/${patientId}/metadata`, authToken, metadata)
      .then(response => {
        setMedicalRecords(prev => ({
          ...prev,
          [patientId]: response.medicalRecord
        }));
        showToast('success', 'Ficha médica básica do paciente atualizada com sucesso!');
      })
      .catch(error => showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar ficha médica.'));
  };

  const handleMarkPaymentPaid = async (appointmentId: string) => {
    try {
      const response = await apiPatch<{ appointment: Appointment }>(`/api/appointments/${appointmentId}/payment`, authToken, { paymentStatus: 'paid' });
      setAppointments(prev => prev.map(a => a.id === appointmentId ? response.appointment : a));
      showToast('success', 'Recebimento confirmado!');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao confirmar recebimento.');
    }
  };

  const handleAddFinanceTransaction = async (transaction: Omit<FinanceTransaction, 'id' | 'date' | 'status' | 'source'>) => {
    try {
      const response = await apiPost<{ transaction: FinanceTransaction }>('/api/finance/transactions', authToken, transaction);
      setFinanceTransactions(prev => [response.transaction, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao lançar financeiro.');
    }
  };

  const handleCreateAgent = async (agent: Omit<ServiceAgent, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ agent: ServiceAgent }>('/api/agents', authToken, agent);
      setServiceAgents(prev => [response.agent, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar agente.');
    }
  };

  const handleUpdateAgent = async (id: string, patch: Partial<ServiceAgent>) => {
    try {
      const response = await apiPatch<{ agent: ServiceAgent }>(`/api/agents/${id}`, authToken, patch);
      setServiceAgents(prev => prev.map(item => item.id === id ? response.agent : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar agente.');
    }
  };

  const handleCreateAgentFromTemplate = async (templateId: string) => {
    try {
      const response = await apiPost<{ agent: ServiceAgent }>(`/api/agent-templates/${templateId}/use`, authToken);
      setServiceAgents(prev => [response.agent, ...prev]);
      showToast('success', `Agente ${response.agent.name} criado a partir do modelo.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar agente por modelo.');
    }
  };

  const handleCreateLlm = async (config: Omit<LlmProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyMasked' | 'isActive'> & { apiKey?: string }) => {
    try {
      const response = await apiPost<{ llm: LlmProviderConfig }>('/api/llms', authToken, config);
      setLlmProviderConfigs(prev => [response.llm, ...prev.map(item => response.llm.isDefault ? { ...item, isDefault: false } : item)]);
      showToast('success', 'LLM cadastrada com sucesso.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar LLM.');
    }
  };

  const handleUpdateLlm = async (id: string, patch: Partial<LlmProviderConfig> & { apiKey?: string }) => {
    try {
      const response = await apiPatch<{ llm: LlmProviderConfig }>(`/api/llms/${id}`, authToken, patch);
      setLlmProviderConfigs(prev => prev.map(item => {
        const next = response.llm.isDefault ? { ...item, isDefault: false } : item;
        return next.id === response.llm.id ? response.llm : next;
      }));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar LLM.');
    }
  };

  const handleCreateKnowledge = async (item: Omit<NeuralKnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    try {
      const response = await apiPost<{ item: NeuralKnowledgeItem }>('/api/neural/knowledge', authToken, item);
      setNeuralKnowledge(prev => [response.item, ...prev]);
      showToast('success', 'Conhecimento indexado na Neural.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao indexar conhecimento.');
    }
  };

  const handleUpdateKnowledge = async (id: string, patch: Partial<NeuralKnowledgeItem>) => {
    try {
      const response = await apiPatch<{ item: NeuralKnowledgeItem }>(`/api/neural/knowledge/${id}`, authToken, patch);
      setNeuralKnowledge(prev => prev.map(item => item.id === id ? response.item : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar conhecimento.');
    }
  };

  const handleCreateCampaign = async (campaign: Omit<MarketingCampaign, 'id' | 'status' | 'leads'>) => {
    try {
      const response = await apiPost<{ campaign: MarketingCampaign }>('/api/marketing/campaigns', authToken, campaign);
      setMarketingCampaigns(prev => [response.campaign, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar campanha.');
    }
  };

  const handleUpdateCampaign = async (id: string, patch: Partial<MarketingCampaign>) => {
    try {
      const response = await apiPatch<{ campaign: MarketingCampaign }>(`/api/marketing/campaigns/${id}`, authToken, patch);
      setMarketingCampaigns(prev => prev.map(item => item.id === id ? response.campaign : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar campanha.');
    }
  };

  const handleCreateTissGuide = async (guide: Omit<TissGuide, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ guide: TissGuide }>('/api/tiss/guides', authToken, guide);
      setTissGuides(prev => [response.guide, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar guia TISS.');
    }
  };

  const handleUpdateTissGuide = async (id: string, patch: Partial<TissGuide>) => {
    try {
      const response = await apiPatch<{ guide: TissGuide }>(`/api/tiss/guides/${id}`, authToken, patch);
      setTissGuides(prev => prev.map(item => item.id === id ? response.guide : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar guia TISS.');
    }
  };

  const handleCreateInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      const response = await apiPost<{ item: InventoryItem }>('/api/inventory/items', authToken, item);
      setInventoryItems(prev => [response.item, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar item de estoque.');
    }
  };

  const handleUpdateInventoryItem = async (id: string, patch: Partial<InventoryItem>) => {
    try {
      const response = await apiPatch<{ item: InventoryItem }>(`/api/inventory/items/${id}`, authToken, patch);
      setInventoryItems(prev => prev.map(item => item.id === id ? response.item : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar estoque.');
    }
  };

  const handleCreateReferral = async (referral: Omit<ReferralRecord, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ referral: ReferralRecord }>('/api/referrals', authToken, referral);
      setReferrals(prev => [response.referral, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao registrar indicação.');
    }
  };

  const handleUpdateReferral = async (id: string, patch: Partial<ReferralRecord>) => {
    try {
      const response = await apiPatch<{ referral: ReferralRecord }>(`/api/referrals/${id}`, authToken, patch);
      setReferrals(prev => prev.map(item => item.id === id ? response.referral : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar indicação.');
    }
  };

  const handleCreateReference = async (reference: Omit<ReferenceMaterial, 'id' | 'updatedAt'>) => {
    try {
      const response = await apiPost<{ reference: ReferenceMaterial }>('/api/references', authToken, reference);
      setReferences(prev => [response.reference, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar referência.');
    }
  };

  const handleCreateHelpTicket = async (ticket: Omit<HelpTicket, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ ticket: HelpTicket }>('/api/help/tickets', authToken, ticket);
      setHelpTickets(prev => [response.ticket, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao abrir chamado.');
    }
  };

  const handleUpdateHelpTicket = async (id: string, patch: Partial<HelpTicket>) => {
    try {
      const response = await apiPatch<{ ticket: HelpTicket }>(`/api/help/tickets/${id}`, authToken, patch);
      setHelpTickets(prev => prev.map(item => item.id === id ? response.ticket : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar chamado.');
    }
  };

  const handleScheduleForPatient = (patientName: string) => {
    const match = patients.find(p => p.fullName.toUpperCase() === patientName.toUpperCase());
    if (match) {
      setSelectedPatientId(match.id);
    }
    setIsSchedulingOpen(true);
  };

  // Filter appointments for active date
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

  const renderView = () => {
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
            token={authToken}
            tenants={tenants}
            plans={plans}
            onRefresh={async () => {
              try {
                const state = await apiGet<BootstrapState>('/api/bootstrap', authToken);
                if (state.tenants) setTenants(state.tenants);
                if (state.plans) setPlans(state.plans);
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
                  onUpdateStatus={handleUpdateAppointmentStatus}
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
            onAddPatient={handleAddPatient}
            onEditPatient={handleEditPatient}
            onViewMedicalRecord={(id) => {
              setActivePatientId(id);
              setActiveView('Prontuários');
            }}
            onScheduleForPatient={handleScheduleForPatient}
          />
        );
      case 'Prontuários':
        return (
          <MedicalRecords 
            patients={patients}
            medicalRecords={medicalRecords}
            doctors={doctors}
            onAddMedicalRecordEntry={handleAddMedicalRecordEntry}
            onUpdateMedicalRecordMetadata={handleUpdateMedicalRecordMetadata}
            activePatientId={activePatientId}
            onActivePatientIdChange={setActivePatientId}
          />
        );
      case 'Mensagens':
        return <WhatsAppInbox token={authToken} onOpenConnections={() => setActiveView('Conexoes')} />;
      case 'Conexoes':
        return <WhatsAppConnections token={authToken} />;
      case 'Assistente IA':
        return <ChatAssistant token={authToken} doctors={doctors} appointments={appointments} patients={patients} llmConfigs={llmProviderConfigs} />;
      case 'Central de Agentes':
        return (
          <AgentsHub
            agents={serviceAgents}
            templates={agentTemplates}
            onCreateAgent={handleCreateAgent}
            onUpdateAgent={handleUpdateAgent}
            onCreateFromTemplate={handleCreateAgentFromTemplate}
          />
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
            onCreateLlm={handleCreateLlm}
            onUpdateLlm={handleUpdateLlm}
          />
        );
      case 'Neural':
        return (
          <NeuralModule
            knowledge={neuralKnowledge}
            agents={serviceAgents}
            onCreateKnowledge={handleCreateKnowledge}
            onUpdateKnowledge={handleUpdateKnowledge}
          />
        );
      case 'Consulta Interativa':
        return <InteractiveConsultation appointments={appointments} patients={patients} doctors={doctors} />;
      case 'Marketing':
        return (
          <MarketingModule
            campaigns={marketingCampaigns}
            agents={serviceAgents}
            onCreateCampaign={handleCreateCampaign}
            onUpdateCampaign={handleUpdateCampaign}
          />
        );
      case 'Financeiro':
        return (
          <Financeiro 
            appointments={appointments}
            financeTransactions={financeTransactions}
            servicePrices={servicePrices}
            onMarkPaymentPaid={handleMarkPaymentPaid}
            onAddTransaction={handleAddFinanceTransaction}
          />
        );
      case 'TISS':
        return (
          <TissModule
            guides={tissGuides}
            appointments={appointments}
            onCreateGuide={handleCreateTissGuide}
            onUpdateGuide={handleUpdateTissGuide}
          />
        );
      case 'Estoques':
        return (
          <InventoryModule
            items={inventoryItems}
            onCreateItem={handleCreateInventoryItem}
            onUpdateItem={handleUpdateInventoryItem}
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
            onCreateReferral={handleCreateReferral}
            onUpdateReferral={handleUpdateReferral}
          />
        );
      case 'Referências':
        return <ReferencesModule references={references} onCreateReference={handleCreateReference} />;
      case 'CRM 360':
        return <CrmModule token={authToken} userRole={currentUser?.role || ''} />;
      case 'NPS & LGPD':
        return <NpsLgpdModule token={authToken} userRole={currentUser?.role || ''} />;
      case 'Automação':
        return <AutomationModule token={authToken} />;
      case 'Ajuda':
        return (
          <HelpModule
            tickets={helpTickets}
            onCreateTicket={handleCreateHelpTicket}
            onUpdateTicket={handleUpdateHelpTicket}
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

  if (!authToken || !currentUser) {
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

  return (
    <ToastProvider>
      <ToastListener />
      <PwaInstallPrompt />
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      <Sidebar activeView={activeView} onNewAppointment={() => setIsSchedulingOpen(true)} onViewChange={(view) => {
        setActiveView(view);
        setIsSidebarOpen(false);
      }} userRole={currentUser?.role} />
      
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative w-72 bg-white h-full shadow-2xl overflow-y-auto p-4 animate-slide-up">
            <div className="flex items-center gap-3 p-2 mb-4" onClick={() => { setActiveView('Dashboard'); setIsSidebarOpen(false); }}>
              <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-white w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-teal-900 tracking-tight">Consultio Med</span>
            </div>
            <div className="space-y-1">
              {[
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
              ].map((item) => {
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
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        
        {renderView()}

        {/* Floating Action Buttons */}
        {!['Mensagens', 'Conexoes', 'Assistente IA', 'Conversas Agentes'].includes(activeView) && (
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
        {isSchedulingOpen && (
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
