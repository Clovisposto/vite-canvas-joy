// Tipos para sistema de envio em massa via WhatsApp

export type BulkJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface BulkJobSettings {
  delay_min: number;  // segundos
  delay_max: number;  // segundos
  max_per_hour: number;
  mode: 'seguro' | 'moderado' | 'rapido';
}

export interface BulkJobContact {
  phone: string;
  name?: string;
  status?: 'pending' | 'sent' | 'failed';
  error?: string;
  sent_at?: string;
}

export interface BulkJob {
  id: string;
  title: string;
  message: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  status: BulkJobStatus;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  settings: BulkJobSettings;
  contacts: BulkJobContact[];
  error_message: string | null;
}

// Configurações padrão por modo
export const BULK_MODE_PRESETS: Record<BulkJobSettings['mode'], Omit<BulkJobSettings, 'mode'>> = {
  seguro: { delay_min: 40, delay_max: 90, max_per_hour: 30 },
  moderado: { delay_min: 20, delay_max: 50, max_per_hour: 50 },
  rapido: { delay_min: 10, delay_max: 30, max_per_hour: 80 },
};

// Helper para estimar tempo total
export function estimateTotalTime(contactCount: number, settings: BulkJobSettings): number {
  const avgDelay = (settings.delay_min + settings.delay_max) / 2;
  return Math.ceil(contactCount * avgDelay / 60); // em minutos
}

// Helper para formatar tempo
export function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}min` : `~${hours}h`;
}
