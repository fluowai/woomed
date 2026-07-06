import { useState, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, BootstrapState } from '../api';
import { showToast } from '../components/Toast';
import {
  Patient, Appointment, Doctor, MedicalRecord, MedicalRecordEntry,
  FinanceTransaction, ServiceAgent, MarketingCampaign, TissGuide,
  InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket,
  LlmProviderConfig, NeuralKnowledgeItem, AppointmentStatus,
  ServicePrice, AuditEvent, PatientDocument, WaitingListEntry,
  ScheduleBlock, MedicalTemplate, AccountsPayable, PaymentGatewayConfig,
  Tenant, SaaSPlan, CrmLead, CrmPipeline, CrmOpportunity,
  CrmTask, CrmInteraction, LeadSource, NpsSurvey, NpsResponse,
  AutomationTemplate, AutomationReminder, LgpdConsentTemplate,
  LgpdPatientConsent, LgpdDataSubjectRequest, LgpdSensitiveAccessLog,
  ProfessionalUnit, ProfessionalRoom, PatientPortalLogin,
  PatientSatisfactionRating, AgentTemplate, DEFAULT_SERVICE_PRICES
} from '../types';
import { DEFAULT_AGENT_TEMPLATES, DEFAULT_LLM_PROVIDER_CONFIGS, DEFAULT_NEURAL_KNOWLEDGE } from '../aiCatalog';

export interface ClinicDataState {
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: Record<string, MedicalRecord>;
  financeTransactions: FinanceTransaction[];
  servicePrices: ServicePrice[];
  auditEvents: AuditEvent[];
  serviceAgents: ServiceAgent[];
  marketingCampaigns: MarketingCampaign[];
  tissGuides: TissGuide[];
  inventoryItems: InventoryItem[];
  referrals: ReferralRecord[];
  references: ReferenceMaterial[];
  helpTickets: HelpTicket[];
  llmProviderConfigs: LlmProviderConfig[];
  agentTemplates: AgentTemplate[];
  neuralKnowledge: NeuralKnowledgeItem[];
  patientDocuments: PatientDocument[];
  waitingList: WaitingListEntry[];
  scheduleBlocks: ScheduleBlock[];
  medicalTemplates: MedicalTemplate[];
  accountsPayable: AccountsPayable[];
  paymentGatewayConfig: PaymentGatewayConfig[];
  tenants: Tenant[];
  plans: SaaSPlan[];
  planFeatures: Record<string, boolean | string | number>;
  planLimits: Record<string, number>;
  crmLeads: CrmLead[];
  crmPipelines: CrmPipeline[];
  crmOpportunities: CrmOpportunity[];
  crmTasks: CrmTask[];
  crmInteractions: CrmInteraction[];
  leadSources: LeadSource[];
  npsSurveys: NpsSurvey[];
  npsResponses: NpsResponse[];
  automationTemplates: AutomationTemplate[];
  automationReminders: AutomationReminder[];
  lgpdConsentTemplates: LgpdConsentTemplate[];
  lgpdPatientConsents: LgpdPatientConsent[];
  lgpdDataSubjectRequests: LgpdDataSubjectRequest[];
  lgpdSensitiveAccessLogs: LgpdSensitiveAccessLog[];
  professionalUnits: ProfessionalUnit[];
  professionalRooms: ProfessionalRoom[];
  patientPortalLogins: PatientPortalLogin[];
  patientSatisfactionRatings: PatientSatisfactionRating[];
}

export interface ClinicDataActions {
  setPatients: (v: Patient[]) => void;
  setDoctors: (v: Doctor[]) => void;
  setAppointments: (v: Appointment[]) => void;
  setMedicalRecords: (v: Record<string, MedicalRecord>) => void;
  setFinanceTransactions: (v: FinanceTransaction[]) => void;
  setServicePrices: (v: ServicePrice[]) => void;
  setAuditEvents: (v: AuditEvent[]) => void;
  setServiceAgents: (v: ServiceAgent[]) => void;
  setMarketingCampaigns: (v: MarketingCampaign[]) => void;
  setTissGuides: (v: TissGuide[]) => void;
  setInventoryItems: (v: InventoryItem[]) => void;
  setReferrals: (v: ReferralRecord[]) => void;
  setReferences: (v: ReferenceMaterial[]) => void;
  setHelpTickets: (v: HelpTicket[]) => void;
  setLlmProviderConfigs: (v: LlmProviderConfig[]) => void;
  setAgentTemplates: (v: AgentTemplate[]) => void;
  setNeuralKnowledge: (v: NeuralKnowledgeItem[]) => void;
  setPatientDocuments: (v: PatientDocument[]) => void;
  setWaitingList: (v: WaitingListEntry[]) => void;
  setScheduleBlocks: (v: ScheduleBlock[]) => void;
  setMedicalTemplates: (v: MedicalTemplate[]) => void;
  setAccountsPayable: (v: AccountsPayable[]) => void;
  setPaymentGatewayConfig: (v: PaymentGatewayConfig[]) => void;
  setTenants: (v: Tenant[]) => void;
  setPlans: (v: SaaSPlan[]) => void;
  setPlanFeatures: (v: Record<string, boolean | string | number>) => void;
  setPlanLimits: (v: Record<string, number>) => void;
  setCrmLeads: (v: CrmLead[]) => void;
  setCrmPipelines: (v: CrmPipeline[]) => void;
  setCrmOpportunities: (v: CrmOpportunity[]) => void;
  setCrmTasks: (v: CrmTask[]) => void;
  setCrmInteractions: (v: CrmInteraction[]) => void;
  setLeadSources: (v: LeadSource[]) => void;
  setNpsSurveys: (v: NpsSurvey[]) => void;
  setNpsResponses: (v: NpsResponse[]) => void;
  setAutomationTemplates: (v: AutomationTemplate[]) => void;
  setAutomationReminders: (v: AutomationReminder[]) => void;
  setLgpdConsentTemplates: (v: LgpdConsentTemplate[]) => void;
  setLgpdPatientConsents: (v: LgpdPatientConsent[]) => void;
  setLgpdDataSubjectRequests: (v: LgpdDataSubjectRequest[]) => void;
  setLgpdSensitiveAccessLogs: (v: LgpdSensitiveAccessLog[]) => void;
  setProfessionalUnits: (v: ProfessionalUnit[]) => void;
  setProfessionalRooms: (v: ProfessionalRoom[]) => void;
  setPatientPortalLogins: (v: PatientPortalLogin[]) => void;
  setPatientSatisfactionRatings: (v: PatientSatisfactionRating[]) => void;

  addAppointment: (apt: Appointment) => void;
  handleAddAppointment: (patientId: string, doctorId: string, date: string, timeStart: string, type: string, observations: string) => Promise<void>;
  handleUpdateAppointmentStatus: (id: string, newStatus: AppointmentStatus) => Promise<void>;
  handleMarkPaymentPaid: (appointmentId: string) => Promise<void>;
  handleAddPatient: (newPatient: Patient) => Promise<void>;
  handleEditPatient: (editedPatient: Patient) => Promise<void>;
  handleCreateDoctor: (doctor: Omit<Doctor, 'id'>) => Promise<void>;
  handleUpdateDoctor: (id: string, doctor: Partial<Doctor>) => Promise<void>;
  handleDeleteDoctor: (id: string) => Promise<void>;
  handleAddMedicalRecordEntry: (patientId: string, entry: MedicalRecordEntry) => Promise<void>;
  handleUpdateMedicalRecordMetadata: (patientId: string, metadata: { bloodType: string; allergies: string[]; medications: string[]; chronicDiseases: string[]; gender: string }) => Promise<void>;
  handleAddFinanceTransaction: (transaction: Omit<FinanceTransaction, 'id' | 'date' | 'status' | 'source'>) => Promise<void>;
  handleCreateAgent: (agent: Omit<ServiceAgent, 'id' | 'createdAt' | 'status'>) => Promise<boolean>;
  handleUpdateAgent: (id: string, patch: Partial<ServiceAgent>) => Promise<void>;
  handleCreateAgentFromTemplate: (templateId: string) => Promise<void>;
  handleCreateLlm: (config: Omit<LlmProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyMasked' | 'isActive'> & { apiKey?: string }) => Promise<void>;
  handleUpdateLlm: (id: string, patch: Partial<LlmProviderConfig> & { apiKey?: string }) => Promise<void>;
  handleCreateKnowledge: (item: Omit<NeuralKnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
  handleUpdateKnowledge: (id: string, patch: Partial<NeuralKnowledgeItem>) => Promise<void>;
  handleCreateCampaign: (campaign: Omit<MarketingCampaign, 'id' | 'status' | 'leads'>) => Promise<void>;
  handleUpdateCampaign: (id: string, patch: Partial<MarketingCampaign>) => Promise<void>;
  handleCreateTissGuide: (guide: Omit<TissGuide, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  handleUpdateTissGuide: (id: string, patch: Partial<TissGuide>) => Promise<void>;
  handleCreateInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  handleUpdateInventoryItem: (id: string, patch: Partial<InventoryItem>) => Promise<void>;
  handleCreateReferral: (referral: Omit<ReferralRecord, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  handleUpdateReferral: (id: string, patch: Partial<ReferralRecord>) => Promise<void>;
  handleCreateReference: (reference: Omit<ReferenceMaterial, 'id' | 'updatedAt'>) => Promise<void>;
  handleCreateHelpTicket: (ticket: Omit<HelpTicket, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  handleUpdateHelpTicket: (id: string, patch: Partial<HelpTicket>) => Promise<void>;
  loadBootstrap: (state: BootstrapState) => void;
}

export function useClinicData(authToken: string | null): [ClinicDataState, ClinicDataActions] {
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
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean | string | number>>({});
  const [planLimits, setPlanLimits] = useState<Record<string, number>>({});
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

  const loadBootstrap = useCallback((state: BootstrapState) => {
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
    setPlanFeatures(state.planFeatures || {});
    setPlanLimits(state.planLimits || {});
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
  }, []);

  const handleAddAppointment = useCallback(async (
    patientId: string, doctorId: string, date: string,
    timeStart: string, type: string, observations: string
  ) => {
    try {
      const response = await apiPost<{ appointment: Appointment }>('/api/appointments', authToken, {
        patientId, doctorId, date, timeStart, type, observations
      });
      setAppointments(prev => [...prev, response.appointment]);
      showToast('success', 'Agendamento cadastrado com sucesso!');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar agendamento.');
      throw error;
    }
  }, [authToken]);

  const handleUpdateAppointmentStatus = useCallback(async (id: string, newStatus: AppointmentStatus) => {
    try {
      const response = await apiPatch<{ appointment: Appointment }>(`/api/appointments/${id}/status`, authToken, { status: newStatus });
      setAppointments(prev => prev.map(a => a.id === id ? response.appointment : a));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar status.');
    }
  }, [authToken]);

  const handleMarkPaymentPaid = useCallback(async (appointmentId: string) => {
    try {
      const response = await apiPatch<{ appointment: Appointment }>(`/api/appointments/${appointmentId}/payment`, authToken, { paymentStatus: 'paid' });
      setAppointments(prev => prev.map(a => a.id === appointmentId ? response.appointment : a));
      showToast('success', 'Recebimento confirmado!');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao confirmar recebimento.');
    }
  }, [authToken]);

  const handleAddPatient = useCallback(async (newPatient: Patient) => {
    try {
      const response = await apiPost<{ patient: Patient; medicalRecord: MedicalRecord }>('/api/patients', authToken, newPatient);
      setPatients(prev => [...prev, response.patient]);
      setMedicalRecords(prev => ({ ...prev, [response.patient.id]: response.medicalRecord }));
      showToast('success', `Paciente ${response.patient.fullName} cadastrado!`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar paciente.');
    }
  }, [authToken]);

  const handleEditPatient = useCallback(async (editedPatient: Patient) => {
    try {
      const response = await apiPut<{ patient: Patient; appointments: Appointment[] }>(`/api/patients/${editedPatient.id}`, authToken, editedPatient);
      setPatients(prev => prev.map(p => p.id === response.patient.id ? response.patient : p));
      setAppointments(response.appointments);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao editar paciente.');
    }
  }, [authToken]);

  const handleCreateDoctor = useCallback(async (doctor: Omit<Doctor, 'id'>) => {
    try {
      const response = await apiPost<{ doctor: Doctor }>('/api/doctors', authToken, doctor);
      setDoctors(prev => [...prev, response.doctor]);
      showToast('success', `Profissional ${response.doctor.name} cadastrado.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar profissional.');
    }
  }, [authToken]);

  const handleUpdateDoctor = useCallback(async (id: string, doctor: Partial<Doctor>) => {
    try {
      const response = await apiPatch<{ doctor: Doctor }>(`/api/doctors/${id}`, authToken, doctor);
      setDoctors(prev => prev.map(item => item.id === response.doctor.id ? response.doctor : item));
      showToast('success', `Profissional ${response.doctor.name} atualizado.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar profissional.');
    }
  }, [authToken]);

  const handleDeleteDoctor = useCallback(async (id: string) => {
    if (!window.confirm('Remover este profissional?')) return;
    try {
      await apiDelete<{ ok: boolean }>(`/api/doctors/${id}`, authToken);
      setDoctors(prev => prev.filter(item => item.id !== id));
      showToast('success', 'Profissional removido.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao remover profissional.');
    }
  }, [authToken]);

  const handleAddMedicalRecordEntry = useCallback(async (patientId: string, entry: MedicalRecordEntry) => {
    try {
      const response = await apiPost<{ entry: MedicalRecordEntry; medicalRecord: MedicalRecord; appointments: Appointment[] }>(
        `/api/medical-records/${patientId}/entries`, authToken,
        { ...entry, date: entry.date }
      );
      setMedicalRecords(prev => ({ ...prev, [patientId]: response.medicalRecord }));
      setAppointments(response.appointments);
      showToast('success', 'Evolução clínica gravada!');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao gravar evolução clínica.');
    }
  }, [authToken]);

  const handleUpdateMedicalRecordMetadata = useCallback(async (
    patientId: string,
    metadata: { bloodType: string; allergies: string[]; medications: string[]; chronicDiseases: string[]; gender: string }
  ) => {
    apiPatch<{ medicalRecord: MedicalRecord }>(`/api/medical-records/${patientId}/metadata`, authToken, metadata)
      .then(response => {
        setMedicalRecords(prev => ({ ...prev, [patientId]: response.medicalRecord }));
        showToast('success', 'Ficha médica atualizada!');
      })
      .catch(error => showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar ficha médica.'));
  }, [authToken]);

  const handleAddFinanceTransaction = useCallback(async (transaction: Omit<FinanceTransaction, 'id' | 'date' | 'status' | 'source'>) => {
    try {
      const response = await apiPost<{ transaction: FinanceTransaction }>('/api/finance/transactions', authToken, transaction);
      setFinanceTransactions(prev => [response.transaction, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao lançar financeiro.');
    }
  }, [authToken]);

  const handleCreateAgent = useCallback(async (agent: Omit<ServiceAgent, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ agent: ServiceAgent }>('/api/agents', authToken, agent);
      setServiceAgents(prev => [response.agent, ...prev]);
      showToast('success', `Agente ${response.agent.name} criado.`);
      return true;
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar agente.');
      return false;
    }
  }, [authToken]);

  const handleUpdateAgent = useCallback(async (id: string, patch: Partial<ServiceAgent>) => {
    try {
      const response = await apiPatch<{ agent: ServiceAgent }>(`/api/agents/${id}`, authToken, patch);
      setServiceAgents(prev => prev.map(item => item.id === id ? response.agent : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar agente.');
    }
  }, [authToken]);

  const handleCreateAgentFromTemplate = useCallback(async (templateId: string) => {
    try {
      const response = await apiPost<{ agent: ServiceAgent }>(`/api/agent-templates/${templateId}/use`, authToken);
      setServiceAgents(prev => [response.agent, ...prev]);
      showToast('success', `Agente ${response.agent.name} criado.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar agente.');
    }
  }, [authToken]);

  const handleCreateLlm = useCallback(async (config: Omit<LlmProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyMasked' | 'isActive'> & { apiKey?: string }) => {
    try {
      const response = await apiPost<{ llm: LlmProviderConfig }>('/api/llms', authToken, config);
      setLlmProviderConfigs(prev => [response.llm, ...prev.map(item => response.llm.isDefault ? { ...item, isDefault: false } : item)]);
      showToast('success', 'LLM cadastrada.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao cadastrar LLM.');
    }
  }, [authToken]);

  const handleUpdateLlm = useCallback(async (id: string, patch: Partial<LlmProviderConfig> & { apiKey?: string }) => {
    try {
      const response = await apiPatch<{ llm: LlmProviderConfig }>(`/api/llms/${id}`, authToken, patch);
      setLlmProviderConfigs(prev => prev.map(item => {
        const next = response.llm.isDefault ? { ...item, isDefault: false } : item;
        return next.id === response.llm.id ? response.llm : next;
      }));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar LLM.');
    }
  }, [authToken]);

  const handleCreateKnowledge = useCallback(async (item: Omit<NeuralKnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    try {
      const response = await apiPost<{ item: NeuralKnowledgeItem }>('/api/neural/knowledge', authToken, item);
      setNeuralKnowledge(prev => [response.item, ...prev]);
      showToast('success', 'Conhecimento indexado.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao indexar conhecimento.');
    }
  }, [authToken]);

  const handleUpdateKnowledge = useCallback(async (id: string, patch: Partial<NeuralKnowledgeItem>) => {
    try {
      const response = await apiPatch<{ item: NeuralKnowledgeItem }>(`/api/neural/knowledge/${id}`, authToken, patch);
      setNeuralKnowledge(prev => prev.map(item => item.id === id ? response.item : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar conhecimento.');
    }
  }, [authToken]);

  const handleCreateCampaign = useCallback(async (campaign: Omit<MarketingCampaign, 'id' | 'status' | 'leads'>) => {
    try {
      const response = await apiPost<{ campaign: MarketingCampaign }>('/api/marketing/campaigns', authToken, campaign);
      setMarketingCampaigns(prev => [response.campaign, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar campanha.');
    }
  }, [authToken]);

  const handleUpdateCampaign = useCallback(async (id: string, patch: Partial<MarketingCampaign>) => {
    try {
      const response = await apiPatch<{ campaign: MarketingCampaign }>(`/api/marketing/campaigns/${id}`, authToken, patch);
      setMarketingCampaigns(prev => prev.map(item => item.id === id ? response.campaign : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar campanha.');
    }
  }, [authToken]);

  const handleCreateTissGuide = useCallback(async (guide: Omit<TissGuide, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ guide: TissGuide }>('/api/tiss/guides', authToken, guide);
      setTissGuides(prev => [response.guide, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar guia TISS.');
    }
  }, [authToken]);

  const handleUpdateTissGuide = useCallback(async (id: string, patch: Partial<TissGuide>) => {
    try {
      const response = await apiPatch<{ guide: TissGuide }>(`/api/tiss/guides/${id}`, authToken, patch);
      setTissGuides(prev => prev.map(item => item.id === id ? response.guide : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar guia TISS.');
    }
  }, [authToken]);

  const handleCreateInventoryItem = useCallback(async (item: Omit<InventoryItem, 'id'>) => {
    try {
      const response = await apiPost<{ item: InventoryItem }>('/api/inventory/items', authToken, item);
      setInventoryItems(prev => [response.item, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar item de estoque.');
    }
  }, [authToken]);

  const handleUpdateInventoryItem = useCallback(async (id: string, patch: Partial<InventoryItem>) => {
    try {
      const response = await apiPatch<{ item: InventoryItem }>(`/api/inventory/items/${id}`, authToken, patch);
      setInventoryItems(prev => prev.map(item => item.id === id ? response.item : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar estoque.');
    }
  }, [authToken]);

  const handleCreateReferral = useCallback(async (referral: Omit<ReferralRecord, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ referral: ReferralRecord }>('/api/referrals', authToken, referral);
      setReferrals(prev => [response.referral, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao registrar indicação.');
    }
  }, [authToken]);

  const handleUpdateReferral = useCallback(async (id: string, patch: Partial<ReferralRecord>) => {
    try {
      const response = await apiPatch<{ referral: ReferralRecord }>(`/api/referrals/${id}`, authToken, patch);
      setReferrals(prev => prev.map(item => item.id === id ? response.referral : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar indicação.');
    }
  }, [authToken]);

  const handleCreateReference = useCallback(async (reference: Omit<ReferenceMaterial, 'id' | 'updatedAt'>) => {
    try {
      const response = await apiPost<{ reference: ReferenceMaterial }>('/api/references', authToken, reference);
      setReferences(prev => [response.reference, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao criar referência.');
    }
  }, [authToken]);

  const handleCreateHelpTicket = useCallback(async (ticket: Omit<HelpTicket, 'id' | 'createdAt' | 'status'>) => {
    try {
      const response = await apiPost<{ ticket: HelpTicket }>('/api/help/tickets', authToken, ticket);
      setHelpTickets(prev => [response.ticket, ...prev]);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao abrir chamado.');
    }
  }, [authToken]);

  const handleUpdateHelpTicket = useCallback(async (id: string, patch: Partial<HelpTicket>) => {
    try {
      const response = await apiPatch<{ ticket: HelpTicket }>(`/api/help/tickets/${id}`, authToken, patch);
      setHelpTickets(prev => prev.map(item => item.id === id ? response.ticket : item));
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao atualizar chamado.');
    }
  }, [authToken]);

  const actions: ClinicDataActions = {
    setPatients, setDoctors, setAppointments, setMedicalRecords,
    setFinanceTransactions, setServicePrices, setAuditEvents,
    setServiceAgents, setMarketingCampaigns, setTissGuides,
    setInventoryItems, setReferrals, setReferences, setHelpTickets,
    setLlmProviderConfigs, setAgentTemplates, setNeuralKnowledge,
    setPatientDocuments, setWaitingList, setScheduleBlocks,
    setMedicalTemplates, setAccountsPayable, setPaymentGatewayConfig,
    setTenants, setPlans, setPlanFeatures, setPlanLimits,
    setCrmLeads, setCrmPipelines, setCrmOpportunities, setCrmTasks,
    setCrmInteractions, setLeadSources,
    setNpsSurveys, setNpsResponses,
    setAutomationTemplates, setAutomationReminders,
    setLgpdConsentTemplates, setLgpdPatientConsents,
    setLgpdDataSubjectRequests, setLgpdSensitiveAccessLogs,
    setProfessionalUnits, setProfessionalRooms,
    setPatientPortalLogins, setPatientSatisfactionRatings,
    addAppointment: (apt) => setAppointments(prev => [...prev, apt]),
    loadBootstrap,
    handleAddAppointment, handleUpdateAppointmentStatus, handleMarkPaymentPaid,
    handleAddPatient, handleEditPatient,
    handleCreateDoctor, handleUpdateDoctor, handleDeleteDoctor,
    handleAddMedicalRecordEntry, handleUpdateMedicalRecordMetadata,
    handleAddFinanceTransaction,
    handleCreateAgent, handleUpdateAgent, handleCreateAgentFromTemplate,
    handleCreateLlm, handleUpdateLlm,
    handleCreateKnowledge, handleUpdateKnowledge,
    handleCreateCampaign, handleUpdateCampaign,
    handleCreateTissGuide, handleUpdateTissGuide,
    handleCreateInventoryItem, handleUpdateInventoryItem,
    handleCreateReferral, handleUpdateReferral,
    handleCreateReference,
    handleCreateHelpTicket, handleUpdateHelpTicket,
  };

  const state: ClinicDataState = {
    patients, doctors, appointments, medicalRecords,
    financeTransactions, servicePrices, auditEvents,
    serviceAgents, marketingCampaigns, tissGuides,
    inventoryItems, referrals, references, helpTickets,
    llmProviderConfigs, agentTemplates, neuralKnowledge,
    patientDocuments, waitingList, scheduleBlocks,
    medicalTemplates, accountsPayable, paymentGatewayConfig,
    tenants, plans, planFeatures, planLimits,
    crmLeads, crmPipelines, crmOpportunities, crmTasks,
    crmInteractions, leadSources,
    npsSurveys, npsResponses,
    automationTemplates, automationReminders,
    lgpdConsentTemplates, lgpdPatientConsents,
    lgpdDataSubjectRequests, lgpdSensitiveAccessLogs,
    professionalUnits, professionalRooms,
    patientPortalLogins, patientSatisfactionRatings,
  };

  return [state, actions];
}
