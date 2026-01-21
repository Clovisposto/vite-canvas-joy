import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  MessageCircle,
  TrendingUp,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ConfirmationLog {
  id: string;
  phone: string;
  message: string;
  status: string;
  provider: string;
  error: string | null;
  created_at: string;
}

interface DashboardStats {
  totalToday: number;
  successToday: number;
  failedToday: number;
  successRate: number;
}

export default function WhatsAppConfirmationsDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ConfirmationLog[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalToday: 0,
    successToday: 0,
    failedToday: 0,
    successRate: 0
  });
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get today's start
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch confirmation logs (messages containing "confirmação" or "sorteio")
      const { data: logsData } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .or('message.ilike.%confirmação%,message.ilike.%sorteio%,message.ilike.%Você está participando%')
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch today's stats
      const { data: todayData } = await supabase
        .from('whatsapp_logs')
        .select('status')
        .or('message.ilike.%confirmação%,message.ilike.%sorteio%,message.ilike.%Você está participando%')
        .gte('created_at', today.toISOString());

      const allLogs = logsData || [];
      const todayLogs = todayData || [];

      const successCount = todayLogs.filter(l => l.status === 'sent' || l.status === 'delivered').length;
      const failedCount = todayLogs.filter(l => l.status === 'error' || l.status === 'failed').length;
      const total = todayLogs.length;

      setLogs(allLogs);
      setStats({
        totalToday: total,
        successToday: successCount,
        failedToday: failedCount,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0
      });
    } catch (error) {
      console.error('Error fetching confirmation logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (log: ConfirmationLog) => {
    setRetrying(log.id);
    try {
      const response = await supabase.functions.invoke('raffle-confirmation', {
        body: { phone: log.phone }
      });

      if (response.error) {
        toast({
          title: 'Erro ao reenviar',
          description: response.error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Mensagem reenviada',
          description: `Confirmação enviada para ${log.phone}`
        });
        fetchData();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível reenviar a mensagem',
        variant: 'destructive'
      });
    } finally {
      setRetrying(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge className="bg-green-500 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'error':
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 13 && phone.startsWith('55')) {
      return `(${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Hoje</p>
                <p className="text-2xl font-bold">{stats.totalToday}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enviados</p>
                <p className="text-2xl font-bold text-green-600">{stats.successToday}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold text-red-600">{stats.failedToday}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Histórico de Confirmações
              </CardTitle>
              <CardDescription>Últimas 100 confirmações de participação no sorteio</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma confirmação enviada ainda</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {formatPhone(log.phone)}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.provider || 'evolution'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                        {log.error || '-'}
                      </TableCell>
                      <TableCell>
                        {(log.status === 'error' || log.status === 'failed') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRetry(log)}
                            disabled={retrying === log.id}
                          >
                            {retrying === log.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
