import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Calendar, Users, Phone, Gift, RefreshCcw, TestTube, CalendarIcon, X, MessageCircle, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import MessageEditorButton from '@/components/admin/MessageEditorButton';
import { toast } from 'sonner';

interface RaffleRun {
  id: string;
  raffle_id: string;
  executed_at: string;
  executed_by: string | null;
  eligible_count: number;
  winners: Array<{ phone: string; name?: string }>;
  seed: string | null;
  is_test: boolean;
  raffle?: {
    name: string;
    prize_value: number;
  };
}

interface SelectedWinner {
  id: string; // unique key: runId_winnerIndex
  phone: string;
  name?: string;
  raffleName: string;
  prizeValue: number;
  runId: string;
}

interface SendResult {
  winner: SelectedWinner;
  success: boolean;
  error?: string;
}

export default function HistoricoSorteios() {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [winnerMessage, setWinnerMessage] = useState<string>('');
  
  // Selection state
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showTestModal, setShowTestModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  
  // Test modal state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  // Send state
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);

  const { data: raffleRuns, isLoading, refetch } = useQuery({
    queryKey: ['raffle-runs', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('raffle_runs')
        .select(`
          *,
          raffle:raffles(name, prize_value)
        `)
        .order('executed_at', { ascending: false });

      if (startDate) {
        query = query.gte('executed_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('executed_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data as RaffleRun[];
    },
  });

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Build selected winners from IDs
  const selectedWinners = useMemo(() => {
    if (!raffleRuns) return [];
    const winners: SelectedWinner[] = [];
    
    raffleRuns.forEach(run => {
      run.winners?.forEach((winner, idx) => {
        const id = `${run.id}_${idx}`;
        if (selectedWinnerIds.has(id)) {
          winners.push({
            id,
            phone: winner.phone,
            name: winner.name,
            raffleName: run.raffle?.name || 'Sorteio',
            prizeValue: run.raffle?.prize_value || 100,
            runId: run.id
          });
        }
      });
    });
    
    return winners;
  }, [raffleRuns, selectedWinnerIds]);

  // Load winner message from database
  const loadWinnerMessage = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'whatsapp_raffle_winner_message')
        .single();

      if (data?.value) {
        const rawValue = data.value;
        const value = typeof rawValue === 'string' 
          ? rawValue.replace(/^"|"$/g, '') 
          : String(rawValue);
        setWinnerMessage(value);
      }
    } catch (error) {
      console.log('Usando mensagem padrão para ganhador');
    }
  };

  useEffect(() => {
    loadWinnerMessage();
  }, []);

  const getDefaultMessage = () => `🎉 *PARABÉNS {{nome}}!* 🎉

Você foi sorteado(a) no *{{sorteio}}*!

🏆 Seu prêmio: *{{premio}}*

Entre em contato conosco para retirar seu prêmio. Estamos muito felizes por você! 🥳

Auto Posto Pará – Economia de verdade!`;

  const buildMessage = (name: string, raffleName: string, prizeValue: number) => {
    const prize = `R$ ${prizeValue.toLocaleString('pt-BR')}`;
    let messageText = winnerMessage || getDefaultMessage();
    
    return messageText
      .replace(/\{\{1\}\}/g, name) // Support {{1}} format from Meta templates
      .replace(/\{\{nome\}\}/g, name)
      .replace(/\{\{sorteio\}\}/g, raffleName)
      .replace(/\{\{premio\}\}/g, prize);
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      const cleaned = digits.slice(2);
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  };

  const isMobileDevice = () =>
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const openWhatsApp = (phone: string, winnerName?: string, raffleName?: string, prizeValue?: number) => {
    const formattedNumber = normalizePhone(phone);
    const message = encodeURIComponent(
      buildMessage(winnerName || 'Cliente', raffleName || 'nosso sorteio', prizeValue || 100)
    );

    const waUrl = isMobileDevice()
      ? `https://wa.me/${formattedNumber}?text=${message}`
      : `https://web.whatsapp.com/send?phone=${formattedNumber}&text=${message}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Toggle winner selection
  const toggleWinnerSelection = (runId: string, winnerIndex: number) => {
    const id = `${runId}_${winnerIndex}`;
    setSelectedWinnerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all winners from a run
  const toggleRunSelection = (run: RaffleRun) => {
    const runWinnerIds = run.winners?.map((_, idx) => `${run.id}_${idx}`) || [];
    const allSelected = runWinnerIds.every(id => selectedWinnerIds.has(id));
    
    setSelectedWinnerIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        runWinnerIds.forEach(id => next.delete(id));
      } else {
        runWinnerIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedWinnerIds(new Set());
  };

  // Open test modal (from floating bar with selected winners)
  const handleOpenTestModal = () => {
    const firstWinner = selectedWinners[0];
    const previewMessage = firstWinner 
      ? buildMessage('Teste', firstWinner.raffleName, firstWinner.prizeValue)
      : buildMessage('Teste', 'Sorteio Semanal', 100);
    setTestMessage(previewMessage);
    setShowTestModal(true);
  };

  // Open test modal directly from header (without needing selected winners)
  const handleOpenTestModalDirect = () => {
    const previewMessage = buildMessage('Teste', 'Sorteio Semanal', 100);
    setTestMessage(previewMessage);
    setShowTestModal(true);
  };

  // Send test message with retry for transient errors
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('Digite um número para teste');
      return;
    }
    
    setIsSendingTest(true);
    
    const maxRetries = 2;
    const retryDelays = [1500, 3000]; // 1.5s, 3s
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('wa-send', {
          body: {
            phone: normalizePhone(testPhone),
            message: testMessage
          }
        });

        if (error) throw error;
        
        if (data?.success) {
          toast.success('Mensagem de teste enviada!');
          setShowTestModal(false);
          setTestPhone('');
          setIsSendingTest(false);
          return;
        }
        
        // Check for transient errors that warrant retry
        const errorMsg = data?.error || '';
        const evolutionDetails = data?.details?.evolution;
        const isTransientError = 
          errorMsg.includes('Connection Closed') ||
          errorMsg.includes('Internal Server Error') ||
          evolutionDetails?.response?.message?.includes('Connection Closed') ||
          (evolutionDetails?.status === 500);
        
        if (isTransientError && attempt < maxRetries) {
          toast.warning(`Conexão instável, tentando novamente... (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
          continue;
        }
        
        // Build detailed error message
        let detailedError = 'Erro ao enviar mensagem';
        if (evolutionDetails?.response?.message) {
          detailedError = `Evolution API: ${evolutionDetails.response.message}`;
        } else if (errorMsg) {
          detailedError = errorMsg;
        }
        
        toast.error(detailedError, {
          description: 'Verifique a conexão do WhatsApp em Robô WhatsApp',
          action: {
            label: 'Abrir Robô',
            onClick: () => window.location.href = '/admin/robo-whatsapp'
          },
          duration: 8000
        });
        break;
      } catch (err: any) {
        if (attempt < maxRetries) {
          toast.warning(`Erro de conexão, tentando novamente... (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
          continue;
        }
        
        toast.error('Falha na comunicação com servidor', {
          description: err.message || 'Verifique sua conexão e tente novamente',
          duration: 6000
        });
      }
    }
    
    setIsSendingTest(false);
  };

  // Send messages to selected winners
  const handleSendToWinners = async () => {
    setShowSendModal(false);
    setIsSending(true);
    setSendResults([]);
    setCurrentSendIndex(0);
    
    const results: SendResult[] = [];
    
    for (let i = 0; i < selectedWinners.length; i++) {
      const winner = selectedWinners[i];
      setCurrentSendIndex(i + 1);
      
      try {
        const message = buildMessage(
          winner.name || 'Cliente',
          winner.raffleName,
          winner.prizeValue
        );
        
        const { data, error } = await supabase.functions.invoke('wa-send', {
          body: {
            phone: normalizePhone(winner.phone),
            message
          }
        });

        if (error) throw error;
        
        if (data?.success) {
          results.push({ winner, success: true });
        } else {
          results.push({ winner, success: false, error: data?.error || 'Erro desconhecido' });
        }
      } catch (err: any) {
        results.push({ winner, success: false, error: err.message || 'Erro de conexão' });
      }
      
      // Delay between sends to avoid rate limiting
      if (i < selectedWinners.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    setSendResults(results);
    setIsSending(false);
    setShowResultsModal(true);
    clearSelection();
  };

  const successCount = sendResults.filter(r => r.success).length;
  const failCount = sendResults.filter(r => !r.success).length;

  return (
    <AdminLayout title="Histórico de Sorteios">
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Ganhadores Anteriores</h2>
              <p className="text-sm text-muted-foreground">
                Veja todos os sorteios realizados e seus vencedores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MessageEditorButton
              settingKey="whatsapp_raffle_winner_message"
              title="Mensagem do Ganhador"
              description="Mensagem enviada quando você clica no botão WhatsApp"
              variables={[
                { key: '{{1}}', desc: 'Nome do cliente (formato Meta)', example: 'João Silva' },
                { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' },
                { key: '{{sorteio}}', desc: 'Nome do sorteio', example: 'Sorteio Semanal' },
                { key: '{{premio}}', desc: 'Valor do prêmio', example: 'R$ 100,00' }
              ]}
              defaultMessage={getDefaultMessage()}
              buttonVariant="outline"
            />
            <Button variant="outline" onClick={handleOpenTestModalDirect}>
              <TestTube className="w-4 h-4 mr-2" />
              Testar Envio
            </Button>
            <Button variant="outline" onClick={() => { refetch(); loadWinnerMessage(); }}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Date Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filtrar por período:</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Start Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">até</span>

                {/* End Date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[160px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {(startDate || endDate) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        {!isLoading && raffleRuns && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{raffleRuns.length}</p>
                    <p className="text-xs text-muted-foreground">Sorteios Realizados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {raffleRuns.reduce((acc, run) => acc + (run.winners?.length || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total de Ganhadores</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {raffleRuns.reduce((acc, run) => acc + (run.eligible_count || 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Participantes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      R$ {raffleRuns.reduce((acc, run) => {
                        const prizeValue = run.raffle?.prize_value || 100;
                        const winnersCount = run.winners?.length || 0;
                        return acc + (prizeValue * winnersCount);
                      }, 0).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Distribuído</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Raffle Runs List */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : raffleRuns && raffleRuns.length > 0 ? (
            raffleRuns.map((run) => {
              const runWinnerIds = run.winners?.map((_, idx) => `${run.id}_${idx}`) || [];
              const allRunWinnersSelected = runWinnerIds.length > 0 && runWinnerIds.every(id => selectedWinnerIds.has(id));
              const someRunWinnersSelected = runWinnerIds.some(id => selectedWinnerIds.has(id));
              
              return (
                <Card key={run.id} className={run.is_test ? 'border-dashed border-warning/50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Select All Checkbox for Run */}
                        {run.winners && run.winners.length > 0 && (
                          <Checkbox
                            checked={allRunWinnersSelected}
                            onCheckedChange={() => toggleRunSelection(run)}
                            className="mt-1"
                          />
                        )}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          run.is_test ? 'bg-warning/10' : 'bg-success/10'
                        }`}>
                          {run.is_test ? (
                            <TestTube className="w-5 h-5 text-warning" />
                          ) : (
                            <Trophy className="w-5 h-5 text-success" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {run.raffle?.name || 'Sorteio'}
                            {run.is_test && (
                              <Badge variant="outline" className="text-warning border-warning">
                                Teste
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(run.executed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        R$ {(run.raffle?.prize_value || 100).toLocaleString('pt-BR')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Winners */}
                      <div>
                        <p className="text-sm font-medium text-foreground mb-2">
                          Ganhadores ({run.winners?.length || 0})
                        </p>
                        <div className="grid gap-2">
                          {run.winners && run.winners.length > 0 ? (
                            run.winners.map((winner, idx) => {
                              const winnerId = `${run.id}_${idx}`;
                              const isSelected = selectedWinnerIds.has(winnerId);
                              
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                                    isSelected 
                                      ? "bg-primary/5 border-primary/30" 
                                      : "bg-muted/50"
                                  )}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleWinnerSelection(run.id, idx)}
                                  />
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                    {idx + 1}º
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-foreground">
                                      {winner.name || 'Cliente'}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                      <Phone className="w-4 h-4 text-primary" />
                                      <span className="tracking-wide">{formatPhone(winner.phone)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400"
                                      onClick={() => openWhatsApp(winner.phone, winner.name, run.raffle?.name, run.raffle?.prize_value)}
                                    >
                                      <MessageCircle className="w-4 h-4 mr-1.5" />
                                      WhatsApp
                                    </Button>
                                    <Badge className="bg-success/10 text-success border-success/30">
                                      <Trophy className="w-3 h-3 mr-1" />
                                      Vencedor
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Nenhum ganhador registrado
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{run.eligible_count} participantes elegíveis</span>
                        </div>
                        {run.seed && (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              Seed: {run.seed.slice(0, 8)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Nenhum sorteio realizado
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Quando você realizar sorteios, os ganhadores aparecerão aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedWinners.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-lg z-50">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {selectedWinners.length} ganhador{selectedWinners.length > 1 ? 'es' : ''} selecionado{selectedWinners.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pronto para disparar mensagem
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
                <Button variant="outline" onClick={handleOpenTestModal}>
                  <TestTube className="w-4 h-4 mr-2" />
                  Testar Envio
                </Button>
                <Button onClick={() => setShowSendModal(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  Disparar Mensagem
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sending Progress Overlay */}
      {isSending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-lg font-semibold">Enviando mensagens...</p>
                  <p className="text-muted-foreground">
                    {currentSendIndex} de {selectedWinners.length}
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(currentSendIndex / selectedWinners.length) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Testar Envio
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem de teste antes de disparar para os ganhadores
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Número para teste</label>
              <Input
                placeholder="91999999999"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Preview da mensagem</label>
              <Textarea
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                rows={8}
                className="mt-1 text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendTest} disabled={isSendingTest}>
              {isSendingTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Teste
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Send Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Disparar Mensagem
            </DialogTitle>
            <DialogDescription>
              Confirme o envio para os ganhadores selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Serão enviadas mensagens para:
            </p>
            <ScrollArea className="h-[200px] rounded-md border p-3">
              <div className="space-y-2">
                {selectedWinners.map(winner => (
                  <div key={winner.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-medium">{winner.name || 'Cliente'}</span>
                    <span className="text-muted-foreground">({formatPhone(winner.phone)})</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-muted-foreground">{winner.raffleName}</span>
                    <span className="font-medium text-success">R$ {winner.prizeValue.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
              <p className="text-sm font-medium text-warning-foreground">
                ⚠️ Confirma o envio para {selectedWinners.length} ganhador{selectedWinners.length > 1 ? 'es' : ''}?
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendToWinners}>
              <Send className="w-4 h-4 mr-2" />
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {failCount === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              Resultado do Envio
            </DialogTitle>
            <DialogDescription>
              {successCount} enviado{successCount !== 1 ? 's' : ''}, {failCount} falha{failCount !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[250px] rounded-md border p-3">
            <div className="space-y-2">
              {sendResults.map((result, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50">
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {result.winner.name || 'Cliente'} - {formatPhone(result.winner.phone)}
                    </p>
                    {result.success ? (
                      <p className="text-success text-xs">Enviado com sucesso</p>
                    ) : (
                      <p className="text-destructive text-xs">{result.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowResultsModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
