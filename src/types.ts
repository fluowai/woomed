/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppointmentStatus = 'atendido' | 'em_atendimento' | 'paciente_no_local' | 'confirmado' | 'agendado' | 'desmarcado';

export interface Appointment {
  id: string;
  doctorId: string; // Linked to a doctor
  date: string;    // YYYY-MM-DD
  timeStart: string;
  timeEnd: string;
  patientName: string;
  status: AppointmentStatus;
  type: string;
  isPrivate: boolean;
  observations: string;
  arrival?: string;
  recordStatus: 'incluso' | 'pendente' | 'desmarcado';
  paymentStatus: 'paid' | 'pending' | 'free';
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  availableDays: string[]; // ['Monday', 'Wednesday', ...]
  workingHours: {
    start: string; // '08:00'
    end: string;   // '18:00'
  };
}

export interface Patient {
  id: string;
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface MedicalRecordEntry {
  id: string;
  date: string;
  doctorName: string;
  notes: string;
  diagnosis?: string;
  prescription?: string;
}

export interface MedicalRecord {
  patientId: string;
  bloodType: string;
  allergies: string[];
  medications: string[];
  chronicDiseases: string[];
  entries: MedicalRecordEntry[];
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p1',
    fullName: 'Bruna Gabriel',
    birthDate: '1992-05-15',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    email: 'bruna.gabriel@email.com',
    avatarUrl: undefined,
    address: {
      street: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100'
    }
  },
  {
    id: 'p2',
    fullName: 'Camila Duarte',
    birthDate: '1988-11-22',
    cpf: '234.567.890-11',
    phone: '(11) 97654-3210',
    email: 'camila.duarte@email.com',
    avatarUrl: undefined,
    address: {
      street: 'Rua Augusta, 500',
      city: 'São Paulo',
      state: 'SP',
      zip: '01412-000'
    }
  },
  {
    id: 'p3',
    fullName: 'Marcos Oliveira',
    birthDate: '1975-03-30',
    cpf: '345.678.901-22',
    phone: '(11) 96543-2109',
    email: 'marcos.oliveira@email.com',
    avatarUrl: undefined,
    address: {
      street: 'Alameda Santos, 200',
      city: 'São Paulo',
      state: 'SP',
      zip: '01419-001'
    }
  }
];

export const MOCK_MEDICAL_RECORDS: Record<string, MedicalRecord> = {
  'p1': {
    patientId: 'p1',
    bloodType: 'A+',
    allergies: ['Amendoim', 'Penicilina'],
    medications: ['Loratadina'],
    chronicDiseases: ['Asma'],
    entries: [
      {
        id: 'e1',
        date: '2025-01-10',
        doctorName: 'Dr. Matheus',
        notes: 'Paciente relatou dores de cabeça frequentes.',
        diagnosis: 'Enxaqueca tensional',
        prescription: 'Dipirona 500mg'
      }
    ]
  }
};

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: 'd1',
    name: 'Dr. Matheus',
    specialty: 'Cardiologista',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    workingHours: { start: '08:00', end: '18:00' }
  },
  {
    id: 'd2',
    name: 'Dra. Ana Paula',
    specialty: 'Dermatologista',
    availableDays: ['Tuesday', 'Thursday'],
    workingHours: { start: '09:00', end: '17:00' }
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '09:00',
    timeEnd: '09:45',
    patientName: 'BRUNA GABRIEL',
    status: 'atendido',
    type: 'Consulta particular',
    isPrivate: true,
    observations: 'Dor de cabeça',
    arrival: '08:57',
    recordStatus: 'incluso',
    paymentStatus: 'paid',
  },
  {
    id: '2',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '10:00',
    timeEnd: '10:30',
    patientName: 'CAMILA DUARTE',
    status: 'em_atendimento',
    type: 'Consulta Convênio',
    isPrivate: false,
    observations: '',
    arrival: '09:55',
    recordStatus: 'incluso',
    paymentStatus: 'pending',
  },
  {
    id: '3',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '10:30',
    timeEnd: '11:00',
    patientName: 'MARCOS OLIVEIRA',
    status: 'paciente_no_local',
    type: 'Retorno',
    isPrivate: false,
    observations: 'Mostrar exames',
    arrival: '10:32',
    recordStatus: 'pendente',
    paymentStatus: 'pending',
  },
  {
    id: '4',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '11:00',
    timeEnd: '11:30',
    patientName: 'BERNARDO MENDES',
    status: 'confirmado',
    type: 'Primeira consulta',
    isPrivate: true,
    observations: 'Vai chegar 15 minutos atrasado',
    arrival: 'N/A',
    recordStatus: 'pendente',
    paymentStatus: 'free',
  },
  {
    id: '5',
    doctorId: 'd2',
    date: '2025-04-03',
    timeStart: '13:00',
    timeEnd: '13:30',
    patientName: 'LUCAS COSTA',
    status: 'agendado',
    type: 'Consulta particular',
    isPrivate: true,
    observations: '',
    arrival: 'N/A',
    recordStatus: 'pendente',
    paymentStatus: 'paid',
  },
  {
    id: '6',
    doctorId: 'd2',
    date: '2025-04-03',
    timeStart: '13:30',
    timeEnd: '14:00',
    patientName: 'EDUARDA FAGUNDES',
    status: 'desmarcado',
    type: 'Retorno',
    isPrivate: false,
    observations: '',
    arrival: 'N/A',
    recordStatus: 'desmarcado',
    paymentStatus: 'paid',
  },
];
