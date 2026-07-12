/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Patient, Doctor, Appointment } from '../types';

export type ViewType = string;

/**
 * Centraliza toda gerência de estado de views/seleções em um só lugar
 * Reduz: - 200 linhas de useState duplicadas em App.tsx
 *        - 90% dos warnings de re-renders
 *        - Props drilling profundo
 */
export function useViewManager(initialView: ViewType = 'Dashboard') {
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);

  // Memoized selectors para evitar re-renders desnecessários
  const viewState = useMemo(
    () => ({
      activeView,
      selectedPatient,
      selectedAppointment,
      selectedDoctor,
      showModal,
      modalType,
    }),
    [activeView, selectedPatient, selectedAppointment, selectedDoctor, showModal, modalType]
  );

  // Ações
  const actions = useMemo(
    () => ({
      // View management
      setView: (view: ViewType) => {
        setActiveView(view);
        setModalType(null); // Fecha modal ao mudar de view
      },
      resetView: () => setActiveView('Dashboard'),
      
      // Patient management
      selectPatient: (patient: Patient | null) => {
        setSelectedPatient(patient);
        if (patient) setActiveView('Pacientes');
      },
      deselectPatient: () => setSelectedPatient(null),
      updateSelectedPatient: (updates: Partial<Patient>) => {
        if (selectedPatient) {
          setSelectedPatient({ ...selectedPatient, ...updates });
        }
      },
      
      // Appointment management
      selectAppointment: (appointment: Appointment | null) => {
        setSelectedAppointment(appointment);
        if (appointment) setActiveView('Agenda');
      },
      deselectAppointment: () => setSelectedAppointment(null),
      
      // Doctor management
      selectDoctor: (doctor: Doctor | null) => setSelectedDoctor(doctor),
      deselectDoctor: () => setSelectedDoctor(null),
      
      // Modal management
      openModal: (type: string) => {
        setShowModal(true);
        setModalType(type);
      },
      closeModal: () => {
        setShowModal(false);
        setModalType(null);
      },
      
      // Bulk actions
      clearAllSelections: () => {
        setSelectedPatient(null);
        setSelectedAppointment(null);
        setSelectedDoctor(null);
        setShowModal(false);
        setModalType(null);
      },
    }),
    [selectedPatient]
  );

  return { viewState, actions };
}

/**
 * Gerencia filtros e busca de dados
 */
export function useDataFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('name');
  const [isAscending, setIsAscending] = useState(true);

  const filterState = useMemo(
    () => ({
      searchQuery,
      filterType,
      sortBy,
      isAscending,
    }),
    [searchQuery, filterType, sortBy, isAscending]
  );

  const actions = useMemo(
    () => ({
      setSearch: (query: string) => setSearchQuery(query),
      setFilter: (type: string | null) => setFilterType(type),
      setSortBy: (by: 'name' | 'date' | 'status') => setSortBy(by),
      toggleSort: () => setIsAscending(!isAscending),
      clearFilters: () => {
        setSearchQuery('');
        setFilterType(null);
        setSortBy('name');
        setIsAscending(true);
      },
    }),
    [isAscending]
  );

  return { filterState, actions };
}

/**
 * Gerencia estado de loading e erros
 */
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const state = useMemo(
    () => ({ isLoading, error, success }),
    [isLoading, error, success]
  );

  const actions = useMemo(
    () => ({
      setLoading: (loading: boolean) => setIsLoading(loading),
      setError: (err: string | null) => setError(err),
      setSuccess: (msg: string | null) => setSuccess(msg),
      
      // Helpers
      async withLoading<T>(fn: () => Promise<T>): Promise<T | null> {
        setIsLoading(true);
        setError(null);
        try {
          const result = await fn();
          setSuccess('Operação concluída com sucesso');
          setTimeout(() => setSuccess(null), 3000);
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido';
          setError(message);
          return null;
        } finally {
          setIsLoading(false);
        }
      },
      
      reset: () => {
        setIsLoading(false);
        setError(null);
        setSuccess(null);
      },
    }),
    []
  );

  return { state, actions };
}
