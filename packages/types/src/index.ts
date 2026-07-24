export interface Tenant {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export type WhatsAppSessionStatus =
  | 'DISCONNECTED'
  | 'DISCONNECTED_NEED_QR'
  | 'CONNECTED'
  | 'FAILED';

export interface WhatsAppSession {
  id: string;
  tenant_id: string;
  status: WhatsAppSessionStatus;
  is_active: boolean; // true = Automação de Aceites Ativa | false = Pausada pelo Prestador
  qr_code?: string | null;
  worker_id?: string | null;
  updated_at: string;
  created_at: string;
}

export interface InviteData {
  id: string;
  idAtendimentoConvite: string;
  idAtendimentoAcionamento: string;
  idAdesao: string;
  idCidadeAtendimento: string;
  distanciaBaseOrigem: string;
  actionUrl: string;
}

export interface AcceptPayload {
  Id: string;
  IdAtendimentoConvite: string;
  IdAtendimentoAcionamento: string;
  Previa: {
    Previa: number;
  };
  Aceito: boolean;
  IdAdesao: string;
  IdCidadeAtendimento: string;
}

export type CapturedCallStatus = 'SUCCESS' | 'FAILED';

export interface CapturedCall {
  id: string;
  tenant_id: string;
  url: string;
  distancia_km?: number | null;
  previa_valor?: number | null;
  duration_ms: number;
  status: CapturedCallStatus;
  response_payload?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at: string;
}

export type SystemLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface SystemLog {
  id: string;
  tenant_id?: string | null;
  level: SystemLogLevel;
  event_type: string;
  message: string;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface MetricsSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDurationMs: number;
  sessionStatus: WhatsAppSessionStatus;
}
