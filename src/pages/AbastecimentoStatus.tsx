import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { 
  Check, 
  Clock, 
  CreditCard, 
  AlertCircle,
  Loader2,
  Fuel,
  User,
  MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import logoGP from "@/assets/logo-gp.png";

interface CheckinStatus {
  success: boolean;
  error?: string;
  created_at?: string;
  phone_masked?: string;
  tag?: string;
  attendant_code?: string;
  payment_status?: string;
  valor?: number;
  forma_pagamento?: string;
  bandeira?: string;
  frentista_nome?: string;
}

export default function AbastecimentoStatus() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  const fetchStatus = async () => {
    if (!token) return;
    
    try {
      const { data, error } = await supabase.rpc('get_public_checkin_status', {
        p_token: token
      });
      
      if (error) {
        console.error('Erro ao buscar status:', error);
        setStatus({ success: false, error: 'Erro ao carregar status' });
      } else {
        setStatus(data as unknown as CheckinStatus);
      }
    } catch (err) {
      console.error('Erro:', err);
      setStatus({ success: false, error: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [token]);

  // Polling automático enquanto aguardando pagamento
  useEffect(() => {
    if (!status?.success || status.payment_status !== 'aguardando' || pollCount >= 60) return;
    
    const interval = setInterval(() => {
      fetchStatus();
      setPollCount(prev => prev + 1);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [status, pollCount]);

  const getPaymentStatusInfo = (paymentStatus?: string) => {
    switch (paymentStatus) {
      case 'aprovado':
        return { 
          icon: Check, 
          color: 'text-success', 
          bgColor: 'bg-success/10', 
          label: 'Pagamento Aprovado' 
        };
      case 'negado':
      case 'cancelado':
        return { 
          icon: AlertCircle, 
          color: 'text-destructive', 
          bgColor: 'bg-destructive/10', 
          label: paymentStatus === 'negado' ? 'Pagamento Negado' : 'Pagamento Cancelado' 
        };
      case 'aguardando':
      default:
        return { 
          icon: Clock, 
          color: 'text-warning', 
          bgColor: 'bg-warning/10', 
          label: 'Aguardando Pagamento' 
        };
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!status?.success) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-50 border-4 border-primary rounded-2xl shadow-lg mb-4">
          <img src={logoGP} alt="Grupo Pará" className="w-12 h-12 object-contain" />
        </div>
        <Card className="w-full max-w-sm p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">
            {status?.error || 'Sessão inválida'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Este link expirou ou não é válido. Por favor, realize um novo cadastro.
          </p>
        </Card>
      </div>
    );
  }

  const paymentInfo = getPaymentStatusInfo(status.payment_status);
  const PaymentIcon = paymentInfo.icon;

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <div className="px-4 pt-8 pb-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-50 border-4 border-primary rounded-2xl shadow-lg mb-3">
            <img src={logoGP} alt="Grupo Pará" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-lg font-bold text-white">
            Status do Abastecimento
          </h1>
        </motion.div>
      </div>

      {/* Card principal */}
      <div className="flex-1 px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="w-full max-w-md mx-auto p-5 rounded-2xl shadow-xl border-0">
            {/* Status do cadastro */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 mb-4">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-success text-sm">Cadastro Registrado</p>
                <p className="text-xs text-success/80">
                  {formatTime(status.created_at)} • {status.phone_masked}
                </p>
              </div>
            </div>

            {/* Status do pagamento */}
            <div className={`flex items-center gap-3 p-4 rounded-xl ${paymentInfo.bgColor} mb-4`}>
              <div className={`w-12 h-12 rounded-full ${paymentInfo.bgColor} flex items-center justify-center`}>
                <PaymentIcon className={`w-6 h-6 ${paymentInfo.color}`} />
              </div>
              <div className="flex-1">
                <p className={`font-bold ${paymentInfo.color} text-base`}>
                  {paymentInfo.label}
                </p>
                {status.payment_status === 'aguardando' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Atualizando automaticamente...
                  </p>
                )}
              </div>
            </div>

            {/* Detalhes do pagamento (quando disponíveis) */}
            {status.payment_status !== 'aguardando' && status.valor && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Valor</span>
                  </div>
                  <span className="font-bold text-foreground">
                    {formatCurrency(status.valor)}
                  </span>
                </div>

                {status.forma_pagamento && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60">
                    <span className="text-sm text-muted-foreground">Forma</span>
                    <span className="font-bold text-foreground capitalize">
                      {status.forma_pagamento}
                      {status.bandeira && ` • ${status.bandeira}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Informações adicionais */}
            <div className="space-y-2 pt-3 border-t border-border">
              {status.tag && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>Ponto: <strong className="text-foreground">{status.tag}</strong></span>
                </div>
              )}
              
              {(status.frentista_nome || status.attendant_code) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>
                    Atendente: <strong className="text-foreground">
                      {status.frentista_nome || status.attendant_code}
                    </strong>
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Fuel className="w-4 h-4" />
                <span>Cliente está participando do sorteio semanal</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-xs">
            Este link expira em 24 horas
          </p>
        </div>
      </div>
    </div>
  );
}
