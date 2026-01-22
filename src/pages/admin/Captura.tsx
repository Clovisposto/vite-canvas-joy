import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, Search, RefreshCw, Filter, AlertTriangle, MessageCircle, Send, X, Loader2, Rocket, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useBulkJobs } from '@/hooks/useBulkJobs';
import BulkJobCreateDialog from '@/components/admin/BulkJobCreateDialog';
import BulkJobProgress from '@/components/admin/BulkJobProgress';
import CSVImportDialog from '@/components/admin/CSVImportDialog';
import BulkPhoneInsertDialog from '@/components/admin/BulkPhoneInsertDialog';

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

export default function AdminCaptura() {
  const { toast } = useToast();
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [frentaFilter, setFrentaFilter] = useState('all');
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState('Olá! Aqui é do Posto. Temos uma novidade especial para você!');
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Bulk Jobs (sistema de fila controlada)
  const [showBulkJobDialog, setShowBulkJobDialog] = useState(false);
  const { jobs, activeJob, createJob, updateJobStatus, updateJobCounters, setActiveJob } = useBulkJobs();
  
  // CSV Import & Manual Phone Insert
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBulkPhoneDialog, setShowBulkPhoneDialog] = useState(false);

  useEffect(() => { fetchCheckins(); }, [periodFilter, paymentFilter, frentaFilter]);

  const getDateFilter = () => {
    // Calcula a data usando fuso horário de Brasília (UTC-3)
    const now = new Date();
    const brasiliaOffset = -3 * 60; // UTC-3 em minutos
    const localOffset = now.getTimezoneOffset();
    const diffMinutes = brasiliaOffset - (-localOffset);
    
    // Ajusta para horário de Brasília
    const brasiliaTime = new Date(now.getTime() + diffMinutes * 60 * 1000);
    
    switch (periodFilter) {
      case 'today':
        // Meia-noite em Brasília
        brasiliaTime.setHours(0, 0, 0, 0);
        // Converte de volta para UTC
        const todayUTC = new Date(brasiliaTime.getTime() - diffMinutes * 60 * 1000);
        return todayUTC.toISOString();
      case 'week':
        now.setDate(now.getDate() - 7);
        return now.toISOString();
      case 'month':
        now.setMonth(now.getMonth() - 1);
        return now.toISOString();
      default:
        return null;
    }
  };

  const fetchCheckins = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('checkins')
        .select('*')
        .order('created_at', { ascending: false });

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      if (paymentFilter !== 'all') {
        query = query.eq('payment_method', paymentFilter);
      }

      if (frentaFilter !== 'all') {
        query = query.eq('attendant_code', frentaFilter);
      }

      const { data: checkinsData, error: checkinsError } = await query.limit(500);
      
      if (checkinsError) {
        console.error('Erro ao buscar checkins:', checkinsError);
        toast({
          title: 'Erro ao carregar capturas',
          description: checkinsError.message,
          variant: 'destructive',
        });
        setCheckins([]);
        return;
      }

      // Buscar customers separadamente pelo telefone (já que customer_id pode estar null)
      const phones = [...new Set((checkinsData || []).map(c => c.phone))];
      
      let customersMap: Record<string, any> = {};
      if (phones.length > 0) {
        const { data: customersData } = await supabase
          .from('customers')
          .select('phone, name, accepts_raffle, accepts_promo, lgpd_consent, lgpd_consent_timestamp, consent_text_version, marketing_opt_in_at')
          .in('phone', phones);
        
        if (customersData) {
          customersMap = customersData.reduce((acc, c) => {
            acc[c.phone] = c;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Buscar pontos de captura (QR codes) para vincular terminal e frentista pela tag
      const tags = [...new Set((checkinsData || []).map(c => c.tag).filter(Boolean))];
      
      let capturePointsMap: Record<string, any> = {};
      if (tags.length > 0) {
        const { data: capturePointsData } = await supabase
          .from('qr_capture_points')
          .select('tag, name, terminal_id, frentista_id, frentistas(nome, codigo)')
          .in('tag', tags);
        
        if (capturePointsData) {
          capturePointsMap = capturePointsData.reduce((acc, cp) => {
            acc[cp.tag] = cp;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Combinar checkins com customers e capture points
      const enrichedCheckins = (checkinsData || []).map(checkin => {
        const capturePoint = checkin.tag ? capturePointsMap[checkin.tag] : null;
        return {
          ...checkin,
          customers: customersMap[checkin.phone] || null,
          capture_point: capturePoint,
          // Preencher frentista/terminal do ponto de captura
          derived_terminal_id: capturePoint?.terminal_id || null,
          derived_frentista_nome: (capturePoint?.frentistas as any)?.nome || null,
          derived_frentista_codigo: (capturePoint?.frentistas as any)?.codigo || checkin.attendant_code || null,
          capture_point_name: capturePoint?.name || null,
        };
      });

      setCheckins(enrichedCheckins);
    } catch (err: any) {
      console.error('Erro inesperado:', err);
      toast({
        title: 'Erro ao carregar capturas',
        description: err?.message || 'Erro inesperado',
        variant: 'destructive',
      });
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  };

  // Group check-ins by phone number
  const groupedByPhone = checkins.reduce((acc, c) => {
    const phone = c.phone;
    if (!acc[phone]) {
      acc[phone] = {
        phone,
        visits: 0,
        customers: c.customers,
        lastVisit: c.created_at,
        firstVisit: c.created_at,
        totalAmount: 0,
        totalLiters: 0,
        is_demo: c.is_demo,
        frentista_codigo: c.derived_frentista_codigo,
        frentista_nome: c.derived_frentista_nome,
        terminal_id: c.derived_terminal_id,
        capture_point_name: c.capture_point_name,
        bandeira: c.stone_tef_logs?.bandeira,
      };
    }
    acc[phone].visits += 1;
    acc[phone].totalAmount += c.amount || 0;
    acc[phone].totalLiters += c.liters || 0;
    // Update frentista info from most recent transaction
    if (new Date(c.created_at) > new Date(acc[phone].lastVisit)) {
      acc[phone].lastVisit = c.created_at;
      acc[phone].frentista_codigo = c.derived_frentista_codigo || acc[phone].frentista_codigo;
      acc[phone].frentista_nome = c.derived_frentista_nome || acc[phone].frentista_nome;
      acc[phone].terminal_id = c.derived_terminal_id || acc[phone].terminal_id;
      acc[phone].capture_point_name = c.capture_point_name || acc[phone].capture_point_name;
      acc[phone].bandeira = c.stone_tef_logs?.bandeira || acc[phone].bandeira;
    }
    if (new Date(c.created_at) < new Date(acc[phone].firstVisit)) {
      acc[phone].firstVisit = c.created_at;
    }
    return acc;
  }, {} as Record<string, any>);

  const grouped = Object.values(groupedByPhone).sort((a: any, b: any) => 
    new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
  );

  const filtered = grouped.filter((c: any) => 
    !search || c.phone?.includes(search) || c.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Check if showing demo data
  const hasRealData = filtered.some((c: any) => !c.is_demo);
  const isDemo = !hasRealData && filtered.some((c: any) => c.is_demo);

  // Calculate totals
  const totals = {
    uniqueCustomers: filtered.length,
    totalVisits: filtered.reduce((sum: number, c: any) => sum + c.visits, 0),
    amount: filtered.reduce((sum: number, c: any) => sum + c.totalAmount, 0),
    liters: filtered.reduce((sum: number, c: any) => sum + c.totalLiters, 0)
  };

  // Get unique frentistas for filter
  const frentistas = [...new Set(checkins.map(c => c.attendant_code).filter(Boolean))];

  const sendSingleMessage = async (phone: string, name?: string) => {
    const message = `Olá${name ? ` ${name}` : ''}! Aqui é do Posto. Como posso ajudar?`;

    try {
      const { data, error } = await supabase.functions.invoke('wa-send', {
        body: { phone, message },
      });

      if (error) throw error;

      if (!data?.success) {
        toast({
          title: 'Erro ao enviar',
          description: data?.error || 'Erro desconhecido',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Mensagem enviada!' });
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast({ title: 'Erro ao enviar', description: err?.message || 'Erro inesperado', variant: 'destructive' });
    }
  };

  const toggleSelect = (phone: string) => {
    const newSelected = new Set(selectedPhones);
    if (newSelected.has(phone)) {
      newSelected.delete(phone);
    } else {
      newSelected.add(phone);
    }
    setSelectedPhones(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPhones.size === filtered.slice(0, 100).length) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(filtered.slice(0, 100).map((c: any) => c.phone)));
    }
  };

  const clearSelection = () => {
    setSelectedPhones(new Set());
  };

  const startBulkSend = () => {
    if (selectedPhones.size === 0) {
      toast({ title: 'Selecione ao menos um cliente', variant: 'destructive' });
      return;
    }
    setShowBulkDialog(true);
  };

  const startBulkJobSend = () => {
    if (selectedPhones.size === 0) {
      toast({ title: 'Selecione ao menos um cliente', variant: 'destructive' });
      return;
    }
    setShowBulkJobDialog(true);
  };

  const handleCreateBulkJob = async (data: { title: string; message: string; mode: 'seguro' | 'moderado' | 'rapido' }) => {
    const contacts = Array.from(selectedPhones).map((phone) => {
      const customer = filtered.find((c: any) => c.phone === phone) as any;
      return { phone, name: customer?.customers?.name };
    });

    const job = await createJob({
      title: data.title,
      message: data.message,
      contacts,
      mode: data.mode,
    });

    if (job) {
      setSelectedPhones(new Set());
      return true;
    }
    return false;
  };

  const sendBulkWhatsApp = async () => {
    setIsSending(true);

    try {
      const customersToSend = Array.from(selectedPhones).map((phone) => {
        const customer = filtered.find((c: any) => c.phone === phone) as any;
        return { phone, name: customer?.customers?.name };
      });

      const { data: result, error } = await supabase.functions.invoke('wa-send', {
        body: { customers: customersToSend, message: bulkMessage },
      });

      if (error) throw error;

      // If the backend returns a config error, surface it explicitly.
      if (result?.total && result?.failed === result?.total && result?.errors?.[0]?.error) {
        toast({
          title: 'Falha no envio em massa',
          description: result.errors[0].error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Envio concluído!',
        description: `${result?.sent || 0} enviados, ${result?.failed || 0} falhas, ${result?.skipped || 0} opt-out.`,
      });

      setShowBulkDialog(false);
      setSelectedPhones(new Set());
    } catch (err: any) {
      console.error('Bulk send error:', err);
      toast({ title: 'Erro no envio em massa', description: err?.message || 'Erro inesperado', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Telefone', 'Nome', 'Frentista Código', 'Frentista Nome', 'Ponto Captura', 'Terminal ID', 'Bandeira', 'Visitas', 'Última Visita', 'Primeira Visita', 'Sorteio', 'Marketing Opt-in', 'Marketing Opt-in Em', 'LGPD', 'LGPD Em', 'Total R$', 'Total Litros', 'Demo'];
    const rows = filtered.map((c: any) => [
      c.phone,
      c.customers?.name || '',
      c.frentista_codigo || '',
      c.frentista_nome || '',
      c.capture_point_name || '',
      c.terminal_id || '',
      c.bandeira || '',
      c.visits,
      format(new Date(c.lastVisit), 'dd/MM/yyyy'),
      format(new Date(c.firstVisit), 'dd/MM/yyyy'),
      c.customers?.accepts_raffle ? 'Sim' : 'Não',
      c.customers?.accepts_promo ? 'Sim' : 'Não',
      c.customers?.marketing_opt_in_at ? format(new Date(c.customers.marketing_opt_in_at), 'dd/MM/yyyy HH:mm') : '',
      c.customers?.lgpd_consent ? 'Sim' : 'Não',
      c.customers?.lgpd_consent_timestamp ? format(new Date(c.customers.lgpd_consent_timestamp), 'dd/MM/yyyy HH:mm') : '',
      c.totalAmount?.toFixed(2) || '',
      c.totalLiters || '',
      c.is_demo ? 'Sim' : 'Não',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captura_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const displayedCustomers = filtered.slice(0, 100);
  const allSelected = displayedCustomers.length > 0 && selectedPhones.size === displayedCustomers.length;

  return (
    <AdminLayout title="Captura de Cliente">
      <div className="space-y-6">
        {/* Demo Badge */}
        {isDemo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400 font-medium">
              🎭 Modo Demonstração - Exibindo dados fictícios
            </span>
          </div>
        )}

        {/* Active Bulk Job Progress */}
        {activeJob && (
          <BulkJobProgress
            job={activeJob}
            onStatusChange={(status) => updateJobStatus(activeJob.id, status)}
            onUpdateCounters={(updates) => updateJobCounters(activeJob.id, updates)}
            onComplete={() => setActiveJob(null)}
          />
        )}

        {/* Selection Bar */}
        {selectedPhones.size > 0 && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-sm px-3 py-1">
                {selectedPhones.size} selecionado(s)
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={startBulkSend} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                <Send className="h-4 w-4 mr-2" /> Envio Direto
              </Button>
              <Button onClick={startBulkJobSend} className="bg-green-600 hover:bg-green-700">
                <Rocket className="h-4 w-4 mr-2" /> Campanha Segura
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar telefone/nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="month">Último Mês</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                </SelectContent>
              </Select>
              <Select value={frentaFilter} onValueChange={setFrentaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Frentista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {frentistas.map(f => (
                    <SelectItem key={f} value={f!}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Clientes ({filtered.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchCheckins}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" onClick={() => setShowBulkPhoneDialog(true)}>
                <Phone className="h-4 w-4 mr-2" /> Telefones
              </Button>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={allSelected} 
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Frentista</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead className="text-center">Visitas</TableHead>
                    <TableHead>Última Visita</TableHead>
                    <TableHead className="text-center">Sorteio</TableHead>
                    <TableHead className="text-center">Marketing</TableHead>
                    <TableHead className="text-center">LGPD</TableHead>
                    <TableHead className="text-right">Total R$</TableHead>
                    <TableHead className="text-right">Total Litros</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : displayedCustomers.map((c: any) => (
                    <TableRow key={c.phone} className={`${c.is_demo ? 'bg-yellow-500/5' : ''} ${selectedPhones.has(c.phone) ? 'bg-primary/5' : ''}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedPhones.has(c.phone)} 
                          onCheckedChange={() => toggleSelect(c.phone)}
                          aria-label={`Selecionar ${c.phone}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{c.phone}</TableCell>
                      <TableCell>{c.customers?.name || '-'}</TableCell>
                      <TableCell>
                        {c.frentista_nome || c.frentista_codigo ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{c.frentista_nome || c.frentista_codigo}</span>
                            {c.frentista_nome && c.frentista_codigo && (
                              <span className="text-xs text-muted-foreground">Cód: {c.frentista_codigo}</span>
                            )}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {c.terminal_id || c.capture_point_name ? (
                          <div className="flex flex-col">
                            {c.capture_point_name && (
                              <span className="font-medium text-sm">{c.capture_point_name}</span>
                            )}
                            {c.terminal_id && (
                              <span className="font-mono text-xs text-muted-foreground">{c.terminal_id}</span>
                            )}
                            {c.bandeira && (
                              <Badge variant="outline" className="text-xs w-fit mt-0.5">{c.bandeira}</Badge>
                            )}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-bold">{c.visits}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(c.lastVisit), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.customers?.accepts_raffle ? 'default' : 'secondary'} className="text-xs">
                          {c.customers?.accepts_raffle ? 'S' : 'N'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge variant={c.customers?.accepts_promo ? 'default' : 'secondary'} className="text-xs">
                            {c.customers?.accepts_promo ? 'Sim' : 'Não'}
                          </Badge>
                          {c.customers?.marketing_opt_in_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(c.customers.marketing_opt_in_at), 'dd/MM/yy HH:mm')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge variant={c.customers?.lgpd_consent ? 'default' : 'destructive'} className="text-xs">
                            {c.customers?.lgpd_consent ? 'Sim' : 'Não'}
                          </Badge>
                          {c.customers?.lgpd_consent_timestamp && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(c.customers.lgpd_consent_timestamp), 'dd/MM/yy HH:mm')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.totalAmount ? c.totalAmount.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.totalLiters || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => sendSingleMessage(c.phone, c.customers?.name)}
                          title="Enviar via API"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Totals Footer */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Clientes Únicos</p>
                <p className="text-2xl font-bold text-foreground">{totals.uniqueCustomers}</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Total Visitas</p>
                <p className="text-2xl font-bold text-foreground">{Number(totals.totalVisits)}</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Total R$</p>
                <p className="text-2xl font-bold text-foreground">
                  {Number(totals.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Total Litros</p>
                <p className="text-2xl font-bold text-foreground">{Number(totals.liters).toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Send Dialog */}
        <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar Mensagem via API</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">
                Enviar para <strong>{selectedPhones.size}</strong> clientes selecionados
              </div>
              <Textarea
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={4}
              />
              <div className="text-xs text-muted-foreground">
                Use {'{nome}'} para personalizar com o nome do cliente
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={sendBulkWhatsApp} 
                disabled={isSending}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Enviar</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Job Create Dialog */}
        <BulkJobCreateDialog
          open={showBulkJobDialog}
          onOpenChange={setShowBulkJobDialog}
          contacts={Array.from(selectedPhones).map(phone => {
            const customer = filtered.find((c: any) => c.phone === phone) as any;
            return { phone, name: customer?.customers?.name };
          })}
          onSubmit={handleCreateBulkJob}
        />

        {/* CSV Import Dialog */}
        <CSVImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImportComplete={fetchCheckins}
        />

        {/* Bulk Phone Insert Dialog */}
        <BulkPhoneInsertDialog
          open={showBulkPhoneDialog}
          onOpenChange={setShowBulkPhoneDialog}
          onImportComplete={fetchCheckins}
        />
      </div>
    </AdminLayout>
  );
}
