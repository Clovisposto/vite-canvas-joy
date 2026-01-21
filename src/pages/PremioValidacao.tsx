import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gift, CheckCircle, XCircle, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AbaterValorModal from '@/components/admin/AbaterValorModal';

interface PremioPublico {
  success: boolean;
  error?: string;
  premio_id?: string;
  nome_mascarado?: string;
  valor_original?: number;
  valor_restante?: number;
  status?: string;
  data_expiracao?: string;
  expirado?: boolean;
}

// Interface para o modal de abatimento (precisa de mais dados)
interface PremioParaAbater {
  id: string;
  codigo: string;
  nome_ganhador: string;
  cpf: string | null;
  telefone: string | null;
  valor_original: number;
  valor_restante: number;
  status: string;
  data_criacao: string;
  data_expiracao: string;
  observacoes: string | null;
}

export default function PremioValidacao() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [premio, setPremio] = useState<PremioPublico | null>(null);
  const [premioCompleto, setPremioCompleto] = useState<PremioParaAbater | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbaterModal, setShowAbaterModal] = useState(false);

  const fetchPremio = async () => {
    if (!codigo) {
      setError('Código de prêmio não informado');
      setLoading(false);
      return;
    }

    try {
      // Usar RPC público que não requer autenticação
      const { data, error: rpcError } = await supabase.rpc('get_premio_publico', {
        p_codigo: codigo
      });

      if (rpcError) throw rpcError;

      const result = data as unknown as PremioPublico;
      
      if (!result.success) {
        setError(result.error || 'Prêmio não encontrado');
        setPremio(null);
      } else {
        setPremio(result);
        // Criar objeto para o modal de abatimento
        setPremioCompleto({
          id: result.premio_id || '',
          codigo: codigo,
          nome_ganhador: result.nome_mascarado || '',
          cpf: null,
          telefone: null,
          valor_original: result.valor_original || 0,
          valor_restante: result.valor_restante || 0,
          status: result.expirado ? 'expirado' : (result.status || 'ativo'),
          data_criacao: '',
          data_expiracao: result.data_expiracao || '',
          observacoes: null
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching premio:', err);
      setError('Erro ao buscar prêmio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPremio();
  }, [codigo]);

  const handleAbatimentoSuccess = () => {
    setShowAbaterModal(false);
    fetchPremio();
  };

  const getStatusBadge = (status: string, expirado?: boolean) => {
    if (expirado) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    switch (status) {
      case 'ativo':
        return <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>;
      case 'expirado':
        return <Badge variant="destructive">Expirado</Badge>;
      case 'zerado':
        return <Badge variant="secondary">Utilizado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !premio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Prêmio Não Encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              {error || 'O código informado não corresponde a nenhum prêmio válido ou expirou.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = premio.expirado ? 'expirado' : (premio.status || 'ativo');
  const isActive = status === 'ativo' && !premio.expirado;
  const isExpired = status === 'expirado' || premio.expirado;
  const isZerado = status === 'zerado';

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isActive 
        ? 'bg-gradient-to-br from-green-500/10 to-background' 
        : isExpired 
          ? 'bg-gradient-to-br from-destructive/10 to-background'
          : 'bg-gradient-to-br from-muted to-background'
    }`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center border-b">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isActive 
              ? 'bg-green-500/20' 
              : isExpired 
                ? 'bg-destructive/20'
                : 'bg-muted'
          }`}>
            {isActive ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : isExpired ? (
              <AlertTriangle className="w-8 h-8 text-destructive" />
            ) : (
              <Gift className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Gift className="h-5 w-5" />
            QR Premiação
          </CardTitle>
          <div className="mt-2">
            {getStatusBadge(status, premio.expirado)}
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Ganhador Info (mascarado) */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{premio.nome_mascarado}</span>
            </div>
            {premio.data_expiracao && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  Válido até: {format(new Date(premio.data_expiracao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>

          {/* Saldo */}
          <div className={`rounded-lg p-6 text-center ${
            isActive ? 'bg-green-500/10' : 'bg-muted'
          }`}>
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível</p>
            <p className={`text-4xl font-bold ${isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
              R$ {(premio.valor_restante || 0).toFixed(2).replace('.', ',')}
            </p>
            {(premio.valor_restante || 0) < (premio.valor_original || 0) && (
              <p className="text-xs text-muted-foreground mt-2">
                Valor original: R$ {(premio.valor_original || 0).toFixed(2).replace('.', ',')}
              </p>
            )}
          </div>

          {/* Status Messages */}
          {isExpired && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
              <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive font-medium">
                Este prêmio expirou
                {premio.data_expiracao && (
                  <> em {format(new Date(premio.data_expiracao), "dd/MM/yyyy", { locale: ptBR })}</>
                )}
              </p>
            </div>
          )}

          {isZerado && (
            <div className="bg-muted border rounded-lg p-4 text-center">
              <CheckCircle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                Este prêmio foi totalmente utilizado
              </p>
            </div>
          )}

          {/* Action Button */}
          {isActive && premioCompleto && (
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setShowAbaterModal(true)}
            >
              <Gift className="w-4 h-4 mr-2" />
              Abater Valor
            </Button>
          )}

          {isActive && (
            <p className="text-xs text-center text-muted-foreground">
              Informe seu nome para registrar o abatimento.
            </p>
          )}
        </CardContent>
      </Card>

      {premioCompleto && codigo && (
        <AbaterValorModal
          open={showAbaterModal}
          onOpenChange={setShowAbaterModal}
          premio={{ ...premioCompleto, codigo }}
          onSuccess={handleAbatimentoSuccess}
        />
      )}
    </div>
  );
}
