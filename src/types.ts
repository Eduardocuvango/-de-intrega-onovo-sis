export type UserRole = 'admin' | 'medic';

export interface User {
  id: string;
  nome: string;
  senha?: string;
  role: UserRole;
  createdAt: string;
}

export type PatientStatus = 'Atendido' | 'Em Espera';
export type PatientPriority = 'Emergência' | 'Muito Urgente' | 'Urgente' | 'Pouco Urgente' | 'Não Urgente';
export type PatientState = 'Internado' | 'Atendido' | 'Transferido' | 'Alta' | 'Óbito';

export interface Patient {
  id: string;
  nome: string;
  genero: 'Masculino' | 'Feminino' | 'Outro';
  dataNascimento: string;
  idade: number;
  faixaEtaria: string;
  dataOcorrencia: string;
  horaEntrada: string;
  horaSaida?: string;
  tempoAtendimento?: number; // em minutos
  status: PatientStatus;
  peso: number;
  temperatura: number;
  pressaoArterial: string;
  provincia: string;
  cidade: string;
  bairro: string;
  ocorrencia: string;
  sinaisSintomas: string;
  diagnosticos: string;
  prioridade: PatientPriority;
  estado: PatientState;
  idMedico: string;
  assinaturaMedico: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  emailAlerts: boolean;
  targetEmail: string;
}
