import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { BulkJob, BulkJobSettings, BulkJobContact, BulkJobStatus } from '@/types/bulk-jobs';
import { BULK_MODE_PRESETS } from '@/types/bulk-jobs';

// Tipo para resposta do Supabase (tabela bulk_send_jobs)
type BulkJobRow = {
  id: string;
  title: string;
  message: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  settings: unknown;
  contacts: unknown;
  error_message: string | null;
};

export function useBulkJobs() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<BulkJob | null>(null);

  // Buscar todos os jobs
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bulk_send_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao buscar jobs:', error);
        // Se a tabela não existe, não mostrar erro
        if (!error.message.includes('does not exist')) {
          toast({ title: 'Erro ao carregar jobs', description: error.message, variant: 'destructive' });
        }
        return;
      }

      // Parse dos campos JSONB com cast explícito
      const parsed = (data || []).map((job) => ({
        ...job,
        status: job.status as BulkJobStatus,
        settings: (typeof job.settings === 'string' ? JSON.parse(job.settings) : job.settings) as BulkJobSettings,
        contacts: (typeof job.contacts === 'string' ? JSON.parse(job.contacts) : job.contacts) as BulkJobContact[],
      })) as BulkJob[];

      setJobs(parsed);
      
      // Atualizar job ativo se existir
      const running = parsed.find(j => j.status === 'running');
      if (running) setActiveJob(running);
    } catch (err: any) {
      console.error('Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Criar novo job
  const createJob = useCallback(async (params: {
    title: string;
    message: string;
    contacts: { phone: string; name?: string }[];
    mode: BulkJobSettings['mode'];
  }): Promise<BulkJob | null> => {
    const settings: BulkJobSettings = {
      mode: params.mode,
      ...BULK_MODE_PRESETS[params.mode],
    };

    const contacts: BulkJobContact[] = params.contacts.map(c => ({
      phone: c.phone,
      name: c.name,
      status: 'pending',
    }));

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('bulk_send_jobs')
        .insert({
          title: params.title,
          message: params.message,
          total_contacts: contacts.length,
          sent_count: 0,
          failed_count: 0,
          pending_count: contacts.length,
          status: 'pending' as BulkJobStatus,
          settings: settings as any,
          contacts: contacts as any,
          created_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar job:', error);
        toast({ title: 'Erro ao criar job', description: error.message, variant: 'destructive' });
        return null;
      }

      const parsed: BulkJob = {
        ...data,
        status: data.status as BulkJobStatus,
        settings: (typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings) as BulkJobSettings,
        contacts: (typeof data.contacts === 'string' ? JSON.parse(data.contacts) : data.contacts) as BulkJobContact[],
      };

      setJobs(prev => [parsed, ...prev]);
      toast({ title: 'Job criado com sucesso!' });
      return parsed;
    } catch (err: any) {
      console.error('Erro ao criar job:', err);
      toast({ title: 'Erro ao criar job', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Atualizar status do job
  const updateJobStatus = useCallback(async (jobId: string, status: BulkJobStatus): Promise<boolean> => {
    try {
      const updates: Partial<BulkJob> = { status };
      
      if (status === 'running' && !activeJob?.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (status === 'completed' || status === 'cancelled' || status === 'error') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bulk_send_jobs')
        .update(updates as any)
        .eq('id', jobId);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        toast({ title: 'Erro ao atualizar job', description: error.message, variant: 'destructive' });
        return false;
      }

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
      
      if (activeJob?.id === jobId) {
        setActiveJob(prev => prev ? { ...prev, ...updates } : null);
      }

      return true;
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      return false;
    }
  }, [activeJob, toast]);

  // Iniciar execução do job
  const startJob = useCallback(async (jobId: string): Promise<boolean> => {
    // Verificar se já tem job rodando
    const runningJob = jobs.find(j => j.status === 'running');
    if (runningJob && runningJob.id !== jobId) {
      toast({ 
        title: 'Job em execução', 
        description: 'Aguarde o job atual terminar antes de iniciar outro.',
        variant: 'destructive' 
      });
      return false;
    }

    const job = jobs.find(j => j.id === jobId);
    if (!job) return false;

    setActiveJob(job);
    return updateJobStatus(jobId, 'running');
  }, [jobs, updateJobStatus, toast]);

  // Pausar job
  const pauseJob = useCallback(async (jobId: string): Promise<boolean> => {
    return updateJobStatus(jobId, 'paused');
  }, [updateJobStatus]);

  // Cancelar job
  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    const result = await updateJobStatus(jobId, 'cancelled');
    if (result && activeJob?.id === jobId) {
      setActiveJob(null);
    }
    return result;
  }, [updateJobStatus, activeJob]);

  // Atualizar contadores do job
  const updateJobCounters = useCallback(async (
    jobId: string, 
    updates: { sent_count?: number; failed_count?: number; pending_count?: number; contacts?: BulkJobContact[]; error_message?: string }
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('bulk_send_jobs')
        .update({
          ...updates,
          contacts: updates.contacts ? (updates.contacts as any) : undefined,
        })
        .eq('id', jobId);

      if (error) {
        console.error('Erro ao atualizar contadores:', error);
        return false;
      }

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
      
      if (activeJob?.id === jobId) {
        setActiveJob(prev => prev ? { ...prev, ...updates } : null);
      }

      return true;
    } catch (err) {
      console.error('Erro ao atualizar contadores:', err);
      return false;
    }
  }, [activeJob]);

  // Carregar jobs na montagem
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Realtime subscription para atualizações
  useEffect(() => {
    const channel = supabase
      .channel('bulk_send_jobs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bulk_send_jobs' },
        (payload) => {
          console.log('[useBulkJobs] Realtime update:', payload);
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    activeJob,
    fetchJobs,
    createJob,
    startJob,
    pauseJob,
    cancelJob,
    updateJobStatus,
    updateJobCounters,
    setActiveJob,
  };
}
