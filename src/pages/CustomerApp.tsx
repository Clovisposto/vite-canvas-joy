import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import StepUnified from '@/components/customer/StepUnified';
import StepConfirmation from '@/components/customer/StepConfirmation';
import StepThankYou from '@/components/customer/StepThankYou';

const pageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 }
};

const pageTransition = {
  type: "tween" as const,
  ease: [0.4, 0, 0.2, 1] as const,
  duration: 0.25
};

export interface CustomerData {
  phone: string;
  name: string;
  acceptsRaffle: boolean;
  acceptsPromo: boolean;
  lgpdConsent: boolean;
  attendantCode: string | null;
  tag: string | null;
}

export default function CustomerApp() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Função para formatar telefone para exibição
  const formatPhoneForDisplay = (phone: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '').slice(0, 11);
    // Remove prefixo 55 se existir para exibição
    const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;
    if (localDigits.length <= 2) return localDigits;
    if (localDigits.length <= 7) return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  };

  // Captura telefone da URL (do QR code)
  const phoneFromUrl = searchParams.get('phone') || searchParams.get('tel') || searchParams.get('telefone') || '';

  const [customerData, setCustomerData] = useState<CustomerData>({
    phone: formatPhoneForDisplay(phoneFromUrl),
    name: '',
    acceptsRaffle: true,
    acceptsPromo: true,
    lgpdConsent: true,
    attendantCode: searchParams.get('attendant') || searchParams.get('attendant_code') || null,
    tag: searchParams.get('tag') || null,
  });

  useEffect(() => {
    // Abortar qualquer requisição anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Criar novo AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .abortSignal(signal);
        
        // Se foi abortado, não atualizar estado
        if (signal.aborted) return;
        
        if (error) {
          console.error('CustomerApp: Erro ao buscar settings', error);
          // Não mostrar erro se foi abort - é esperado em remontagens
          if (error.message?.includes('abort')) {
            return;
          }
          setInitError(`Erro ao carregar: ${error.message}`);
          return;
        }
        
        if (data) {
          const settingsMap: Record<string, any> = {};
          data.forEach((s: any) => {
            try {
              settingsMap[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
            } catch {
              settingsMap[s.key] = s.value;
            }
          });
          setSettings(settingsMap);
        }
      } catch (err: any) {
        // Ignorar erros de abort
        if (err?.name === 'AbortError' || signal.aborted) {
          return;
        }
        console.error('CustomerApp: Exceção em fetchSettings', err);
        setInitError(`Erro de conexão. Tente novamente.`);
      } finally {
        if (!signal.aborted) {
          setIsInitializing(false);
        }
      }
    };
    
    fetchSettings();
    
    // Cleanup: abortar requisição ao desmontar
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    
    const phoneDigits = customerData.phone.replace(/\D/g, '');
    
    // Validação robusta: celular brasileiro = 11 dígitos (DDD + 9 + 8 dígitos)
    if (phoneDigits.length !== 11) {
      toast({
        title: 'Telefone inválido',
        description: 'Digite DDD + 9 dígitos do celular.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
    // Não adicionar 55 duas vezes
    const phoneE164 = phoneDigits.startsWith('55') ? phoneDigits : ('55' + phoneDigits);
    
    const now = new Date();
    const consentTimestamp = now.toISOString();

    let finalAttendantCode = customerData.attendantCode;
    
    if (customerData.tag && !finalAttendantCode) {
      try {
        const { data: capturePoint } = await supabase
          .from('qr_capture_points')
          .select('terminal_id, frentista_id, frentistas(codigo)')
          .eq('tag', customerData.tag)
          .eq('is_active', true)
          .maybeSingle();

        if (capturePoint) {
          if (capturePoint.frentista_id && capturePoint.frentistas) {
            finalAttendantCode = (capturePoint.frentistas as any).codigo;
          } else if (capturePoint.terminal_id) {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            
            const { data: stoneTransaction } = await supabase
              .from('stone_tef_logs')
              .select('frentista_id, frentista_nome')
              .eq('terminal_id', capturePoint.terminal_id)
              .gte('horario', thirtyMinutesAgo)
              .order('horario', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (stoneTransaction?.frentista_id) {
              finalAttendantCode = stoneTransaction.frentista_id;
            }
          }
        }
      } catch (err) {
        console.log('PWA: Não foi possível identificar frentista automaticamente', err);
      }
    }
    
    try {
      // Upsert no wa_contacts (a tabela de contatos correta)
      const { error: e1 } = await supabase
        .from('wa_contacts')
        .upsert({
          phone: phoneE164,
          name: customerData.name?.trim() || null,
          opt_in: true,
          opt_in_timestamp: consentTimestamp,
        }, { onConflict: 'phone' });

      if (e1) {
        console.error('PWA cadastro erro wa_contacts', { e1, phoneE164 });
        // Continuar mesmo se falhar o upsert do contato
      }

      const { data: rpcResult, error: rpcError } = await supabase.rpc('public_create_checkin_and_token', {
        p_phone: phoneE164,
        p_attendant_code: finalAttendantCode ?? null,
        p_tag: customerData.tag ?? null
      });

      const result = rpcResult as unknown as { success: boolean; token: string; checkin_id: string } | null;

      if (rpcError || !result?.success) {
        console.error('PWA cadastro erro checkins via RPC', { rpcError, rpcResult, phoneE164 });
        throw rpcError || new Error('Erro ao criar checkin');
      }

      console.log('PWA cadastro sucesso', { phoneE164, attendantCode: finalAttendantCode });

      // Send WhatsApp confirmation (fire and forget)
      supabase.functions.invoke('raffle-confirmation', {
        body: { phone: phoneE164 }
      }).then(({ data, error }) => {
        if (error) {
          console.log('PWA: WhatsApp confirmation failed (non-blocking)', error);
        } else {
          console.log('PWA: WhatsApp confirmation sent', data);
        }
      }).catch((waError) => {
        console.log('PWA: WhatsApp confirmation error (non-blocking)', waError);
      });

      // Go to confirmation screen
      setStep(2);
    } catch (error: any) {
      console.error('PWA cadastro erro', { error, phoneE164 });
      toast({
        title: 'Erro ao finalizar cadastro',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmationComplete = useCallback(() => {
    setStep(3);
  }, []);

  const handleAutoReset = useCallback(() => {
    setCustomerData(prev => ({ ...prev, phone: '', name: '' }));
    setStep(1);
  }, []);

  const handleRetry = useCallback(() => {
    setInitError(null);
    setIsInitializing(true);
    // Forçar remontagem do useEffect
    window.location.reload();
  }, []);

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro de inicialização se houver
  if (initError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full text-center">
          <h1 className="text-xl font-bold text-red-600 mb-4">Erro de Conexão</h1>
          <p className="text-gray-600 mb-4">{initError}</p>
          <button
            onClick={handleRetry}
            className="bg-primary text-white py-2 px-6 rounded hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-ios bg-background overflow-x-hidden overflow-y-auto">
      <AnimatePresence mode="wait">
        {/* Step 1: Captura de dados */}
        {step === 1 && (
          <motion.div
            key="unified"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <StepUnified 
              postoName={settings.posto_name || 'Posto 7'} 
              phone={customerData.phone}
              name={customerData.name}
              onPhoneChange={(phone) => setCustomerData(prev => ({ ...prev, phone }))}
              onNameChange={(name) => setCustomerData(prev => ({ ...prev, name }))}
              onSubmit={handleSubmit}
              loading={loading}
            />
          </motion.div>
        )}
        
        {/* Step 2: Confirmação com contador */}
        {step === 2 && (
          <motion.div
            key="confirmation"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <StepConfirmation onComplete={handleConfirmationComplete} />
          </motion.div>
        )}

        {/* Step 3: Agradecimento final */}
        {step === 3 && (
          <motion.div
            key="thankyou"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <StepThankYou postoName={settings.posto_name || 'Posto 7'} onAutoReset={handleAutoReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
