import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { BulkJob, BulkJobContact } from '@/types/bulk-jobs';

interface Props {
  job: BulkJob;
  onStatusChange: (status: BulkJob['status']) => Promise<boolean>;
  onUpdateCounters: (updates: { 
    sent_count?: number; 
    failed_count?: number; 
    pending_count?: number; 
    contacts?: BulkJobContact[];
    error_message?: string;
  }) => Promise<boolean>;
  onComplete: () => void;
}

// Normaliza telefone para formato E.164 brasileiro
function normalizePhoneBR(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const withoutPrefix = digits.startsWith('55') ? digits.slice(2) : digits;
  const local = withoutPrefix.length > 11 ? withoutPrefix.slice(-11) : withoutPrefix;
  return `55${local}`;
}

// Delay randômico entre min e max segundos
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

export default function BulkJobProgress({ job, onStatusChange, onUpdateCounters, onComplete }: Props) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentContact, setCurrentContact] = useState<string | null>(null);
  const [nextSendIn, setNextSendIn] = useState<number>(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const abortRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const progress = job.total_contacts > 0 
    ? Math.round(((job.sent_count + job.failed_count) / job.total_contacts) * 100) 
    : 0;

  // Função de envio individual via API
  const sendMessage = useCallback(async (phone: string, message: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedPhone = normalizePhoneBR(phone);
    const personalizedMessage = message.replace('{nome}', name || 'Cliente');

    try {
      const { data, error } = await supabase.functions.invoke('wa-send', {
        body: { phone: normalizedPhone, message: personalizedMessage },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Erro desconhecido' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de rede' };
    }
  }, []);

  // Processa a fila de contatos
  const processQueue = useCallback(async () => {
    if (job.status !== 'running' || isProcessing) return;
    
    setIsProcessing(true);
    abortRef.current = false;

    const contacts = [...job.contacts];
    let sentCount = job.sent_count;
    let failedCount = job.failed_count;
    let pendingCount = job.pending_count;
    let errors = consecutiveErrors;

    for (let i = 0; i < contacts.length; i++) {
      // Verificar se deve parar
      if (abortRef.current) {
        console.log('[BulkJobProgress] Aborted');
        break;
      }

      const contact = contacts[i];
      if (contact.status !== 'pending') continue;

      // Verificar limite de erros consecutivos
      if (errors >= 5) {
        toast({
          title: 'Pausado automaticamente',
          description: '5 erros consecutivos detectados. Verifique a conexão.',
          variant: 'destructive',
        });
        await onStatusChange('paused');
        break;
      }

      setCurrentContact(contact.phone);

      // Enviar mensagem
      const result = await sendMessage(contact.phone, job.message, contact.name);

      if (result.success) {
        contacts[i] = { ...contact, status: 'sent', sent_at: new Date().toISOString() };
        sentCount++;
        pendingCount--;
        errors = 0;
      } else {
        contacts[i] = { ...contact, status: 'failed', error: result.error };
        failedCount++;
        pendingCount--;
        errors++;
      }

      setConsecutiveErrors(errors);

      // Atualizar contadores no banco
      await onUpdateCounters({
        sent_count: sentCount,
        failed_count: failedCount,
        pending_count: pendingCount,
        contacts,
      });

      // Verificar se terminou
      if (pendingCount === 0) {
        await onStatusChange('completed');
        toast({ title: 'Campanha concluída!', description: `${sentCount} enviados, ${failedCount} falhas` });
        onComplete();
        break;
      }

      // Delay antes da próxima mensagem
      if (!abortRef.current && pendingCount > 0) {
        const delay = randomDelay(job.settings.delay_min, job.settings.delay_max);
        const startTime = Date.now();
        
        // Countdown visual
        intervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, Math.ceil((delay - elapsed) / 1000));
          setNextSendIn(remaining);
        }, 100);

        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setNextSendIn(0);
      }
    }

    setIsProcessing(false);
    setCurrentContact(null);
  }, [job, isProcessing, consecutiveErrors, sendMessage, onStatusChange, onUpdateCounters, onComplete, toast]);

  // Iniciar/continuar processamento quando status = running
  useEffect(() => {
    if (job.status === 'running' && !isProcessing && job.pending_count > 0) {
      processQueue();
    }
  }, [job.status, isProcessing, job.pending_count, processQueue]);

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handlePlay = async () => {
    await onStatusChange('running');
  };

  const handlePause = async () => {
    abortRef.current = true;
    await onStatusChange('paused');
  };

  const handleCancel = async () => {
    abortRef.current = true;
    await onStatusChange('cancelled');
    onComplete();
  };

  const statusConfig: Record<BulkJob['status'], { color: string; label: string }> = {
    pending: { color: 'bg-gray-500', label: 'Aguardando' },
    running: { color: 'bg-blue-500', label: 'Executando' },
    paused: { color: 'bg-yellow-500', label: 'Pausado' },
    completed: { color: 'bg-green-500', label: 'Concluído' },
    cancelled: { color: 'bg-red-500', label: 'Cancelado' },
    error: { color: 'bg-red-600', label: 'Erro' },
  };

  const status = statusConfig[job.status];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{job.title}</CardTitle>
            <Badge className={`${status.color} text-white`}>{status.label}</Badge>
          </div>
          <div className="flex gap-2">
            {(job.status === 'pending' || job.status === 'paused') && (
              <Button size="sm" onClick={handlePlay} className="bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4 mr-1" /> {job.status === 'paused' ? 'Continuar' : 'Iniciar'}
              </Button>
            )}
            {job.status === 'running' && (
              <Button size="sm" variant="outline" onClick={handlePause}>
                <Pause className="h-4 w-4 mr-1" /> Pausar
              </Button>
            )}
            {(job.status !== 'completed' && job.status !== 'cancelled') && (
              <Button size="sm" variant="destructive" onClick={handleCancel}>
                <Square className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-2 rounded-lg bg-background">
            <div className="text-2xl font-bold">{job.total_contacts}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{job.sent_count}</span>
            </div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-500/10">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{job.failed_count}</span>
            </div>
            <div className="text-xs text-muted-foreground">Falhas</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{job.pending_count}</span>
            </div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </div>
        </div>

        {/* Status atual */}
        {job.status === 'running' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm">
              {currentContact ? (
                <>Enviando para <code className="bg-muted px-1 rounded">{currentContact}</code></>
              ) : nextSendIn > 0 ? (
                <>Próximo envio em <strong>{nextSendIn}s</strong></>
              ) : (
                'Processando...'
              )}
            </span>
          </div>
        )}

        {/* Erros consecutivos */}
        {consecutiveErrors > 2 && job.status === 'running' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              {consecutiveErrors} erros consecutivos. Pausará automaticamente em {5 - consecutiveErrors} falhas.
            </span>
          </div>
        )}

        {/* Erro do job */}
        {job.error_message && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">{job.error_message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
