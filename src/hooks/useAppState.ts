import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ViewType = string;

const todayDate = () => new Date().toISOString().split('T')[0];

export function useAppState() {
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Sync activeView → URL
  const syncView = (view: string) => {
    setActiveView(view);
    if (view && view !== 'Dashboard') {
      setSearchParams({ view }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return {
    activeView, setActiveView: syncView,
    activeSaasSection, setActiveSaasSection,
    isSchedulingOpen, setIsSchedulingOpen,
    isSidebarOpen, setIsSidebarOpen,
    currentDate, setCurrentDate,
    viewMode, setViewMode,
    agendaSearch, setAgendaSearch,
    selectedPatientId, setSelectedPatientId,
    selectedDoctorId, setSelectedDoctorId,
    selectedDate, setSelectedDate,
    selectedTime, setSelectedTime,
    selectedProcedure, setSelectedProcedure,
    aiSuggestions, setAiSuggestions,
    isAiLoading, setIsAiLoading,
    hasConflict, setHasConflict,
    activePatientId, setActivePatientId
  };
}
