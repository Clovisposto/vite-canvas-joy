import { useState, useEffect, useCallback } from 'react';
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
  console.log('CustomerApp: componente montando');
  
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1 = Captura, 2 = Confirmação, 3 = Agradecimento
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [initError, setInitError] = useState<string | null>(null);
  
  const [customerData, setCustomerData] = useState<CustomerData>({
    phone: '',
    name: '',
    acceptsRaffle: true,
    acceptsPromo: true,
    lgpdConsent: true,
    attendantCode: searchParams.get('attendant') || searchParams.get('attendant_code') || null,
    tag: searchParams.get('tag') || null,
  });

  useEffect(() => {
    console.log('CustomerApp: useEffect iniciando fetchSettings');
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    console.log('CustomerApp: fetchSettings iniciando');
    try {
      const { data, error } = await supabase.from('settings').select('*');
      console.log('CustomerApp: fetchSettings resultado', { data, error });
      
      if (error) {
        console.error('CustomerApp: Erro ao buscar settings', error);
        setInitError(`Erro Supabase: ${error.message}`);
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
        console.log('CustomerApp: settings carregadas', settingsMap);
        setSettings(settingsMap);
      }
    } catch (err) {
      console.error('CustomerApp: Exceção em fetchSettings', err);
      setInitError(`Exceção: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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

    // NEW: espelha lead no Neon/Vercel Postgres (não bloqueia fluxo atual)
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneE164,
        acceptsPromo: customerData.acceptsPromo,
        acceptsRaffle: customerData.acceptsRaffle,
        consent: customerData.lgpdConsent,
        tag: customerData.tag,
        attendantCode: customerData.attendantCode,
        source: "pwa"
      })
    }).catch(()=>{});
    
    const now = new Date();
    const consentVersion = `lgpd-v1-${now.toISOString().split('T')[0]}`;
    const consentTimestamp = now.toISOString();

    let finalAttendantCode = customerData.attendantCode;
    
    if (customerData.tag && !finalAttendantCode) {
      try {
        const { data: capturePoint } = await supabase
          .from('qr_capture_points')
          .select('terminal_id, frentista_id, frentistas(codigo)')
          .eq('tag', customerData.tag)
          .eq('is_active', true)
          .single();

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
              .single();

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
      const { error: e1 } = await supabase
        .from('customers')
        .insert({
          phone: phoneE164,
          name: customerData.name?.trim() || null,
          accepts_raffle: true,
          accepts_promo: true,
          lgpd_consent: true,
          lgpd_consent_timestamp: consentTimestamp,
          lgpd_version: '1.0',
          consent_text_version: consentVersion,
          consent_source: 'implicit_button',
          marketing_opt_in_at: consentTimestamp
        });

      if (e1 && e1.code !== '23505') {
        console.error('PWA cadastro erro customers', { e1, phoneE164 });
        throw e1;
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

      
      // Mirror capture into Vercel Postgres (non-blocking)
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneE164,
          name: customerData.name?.trim() || null,
          acceptsPromo: customerData.acceptsPromo,
          acceptsRaffle: customerData.acceptsRaffle,
          consent: customerData.lgpdConsent,
          tag: customerData.tag,
          attendantCode: finalAttendantCode
        })
      }).catch(() => {});

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

  console.log('CustomerApp: renderizando, step =', step, 'initError =', initError);

  // Mostrar erro de inicialização se houver
  if (initError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full text-center">
          <h1 className="text-xl font-bold text-red-600 mb-4">Erro de Conexão</h1>
          <p className="text-gray-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
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
