import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  RefreshCw, 
  FileSpreadsheet,
  Calendar,
  User,
  Phone,
  Fuel,
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Star,
  QrCode,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface ProductionRecord {
  id: string;
  phone: string;
  customer_name: string | null;
  attendant_code: string | null;
  attendant_name: string | null;
  created_at: string;
  amount: number | null;
  liters: number | null;
  payment_method: string | null;
  origin: string | null;
  customer_rating: number | null;
  total_visits: number;
  total_amount: number;
  total_liters: number;
}

interface Frentista {
  id: string;
  codigo: string;
  nome: string;
}

const PAYMENT_METHODS = [
  { key: 'all', label: 'Todos', icon: Receipt },
  { key: 'pix', label: 'PIX', icon: Smartphone },
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'debito', label: 'Débito', icon: CreditCard },
  { key: 'credito', label: 'Crédito', icon: CreditCard },
  { key: 'voucher', label: 'Voucher', icon: Receipt },
];

export default function RelatorioProducao() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [frentistas, setFrentistas] = useState<Frentista[]>([]);
  const [selectedTab, setSelectedTab] = useState('all');
  
  // Filters
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch frentistas
    const { data: frentistasData } = await supabase
      .from('frentistas')
      .select('id, codigo, nome');
    
    setFrentistas(frentistasData || []);

    // Fetch checkins with customer data
    const { data: checkinsData } = await supabase
      .from('checkins')
      .select(`
        id,
        phone,
        attendant_code,
        created_at,
        amount,
        liters,
        payment_method,
        origin,
        customer_id,
        customers!checkins_customer_id_fkey (
          name,
          phone
        )
      `)
      .gte('created_at', startOfDay(new Date(startDate)).toISOString())
      .lte('created_at', endOfDay(new Date(endDate)).toISOString())
      .order('created_at', { ascending: false });

    // Fetch Stone TEF logs for payment info
    const { data: stoneLogs } = await supabase
      .from('stone_tef_logs')
      .select('*')
      .gte('created_at', startOfDay(new Date(startDate)).toISOString())
      .lte('created_at', endOfDay(new Date(endDate)).toISOString());

    // Fetch complaints for ratings
    const { data: complaintsData } = await supabase
      .from('complaints')
      .select('phone, message, created_at')
      .gte('created_at', startOfDay(new Date(startDate)).toISOString())
      .lte('created_at', endOfDay(new Date(endDate)).toISOString());

    // Create a map for ratings by phone
    const ratingsMap: Record<string, number> = {};
    complaintsData?.forEach(c => {
      if (c.phone && c.message?.includes('Avaliação:')) {
        const match = c.message.match(/Avaliação: (\\d) estrelas/);
        if (match) {
          ratingsMap[c.phone] = parseInt(match[1]);
        }
      }
    });

    // Create Stone logs map for enhanced payment info
    const stoneMap: Record<string, any> = {};
    stoneLogs?.forEach(log => {
      if (log.checkin_id) {
        stoneMap[log.checkin_id] = log;
      }
    });

    // Group by phone and aggregate
    const phoneAggregation: Record<string, {
      visits: number;
      totalAmount: number;
      totalLiters: number;
      lastRecord: any;
    }> = {};

    checkinsData?.forEach(checkin => {
      const phone = checkin.phone;
      if (!phoneAggregation[phone]) {
        phoneAggregation[phone] = {
          visits: 0,
          totalAmount: 0,
          totalLiters: 0,
          lastRecord: checkin
        };
      }
      phoneAggregation[phone].visits++;
      phoneAggregation[phone].totalAmount += checkin.amount || 0;
      phoneAggregation[phone].totalLiters += checkin.liters || 0;
      // Keep the most recent record
      if (new Date(checkin.created_at) > new Date(phoneAggregation[phone].lastRecord.created_at)) {
        phoneAggregation[phone].lastRecord = checkin;
      }
    });

    // Build production records
    const productionRecords: ProductionRecord[] = Object.entries(phoneAggregation).map(([phone, data]) => {
      const checkin = data.lastRecord;
      const stoneLog = stoneMap[checkin.id];
      const frentista = frentistasData?.find(f => f.codigo === checkin.attendant_code);
      const customer = checkin.customers as any;

      return {
        id: checkin.id,
        phone,
        customer_name: customer?.name || null,
        attendant_code: stoneLog?.frentista_id || checkin.attendant_code,
        attendant_name: stoneLog?.frentista_nome || frentista?.nome || null,
        created_at: checkin.created_at,
        amount: checkin.amount,
        liters: checkin.liters,
        payment_method: stoneLog?.forma_pagamento || checkin.payment_method,
        origin: checkin.origin,
        customer_rating: ratingsMap[phone] || null,
        total_visits: data.visits,
        total_amount: data.totalAmount,
        total_liters: data.totalLiters
      };
    });

    setRecords(productionRecords);
    setLoading(false);
  };

  // Filter records by payment method and search term
  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // Filter by payment method
    if (selectedTab !== 'all') {
      filtered = filtered.filter(r => {
        const method = r.payment_method?.toLowerCase() || '';
        return method.includes(selectedTab.toLowerCase());
      });
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.phone.includes(term) ||
        r.customer_name?.toLowerCase().includes(term) ||
        r.attendant_code?.toLowerCase().includes(term) ||
        r.attendant_name?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [records, selectedTab, searchTerm]);

  // Calculate totals for each tab
  const tabTotals = useMemo(() => {
    const totals: Record<string, { count: number; amount: number; liters: number }> = {};
    
    PAYMENT_METHODS.forEach(method => {
      if (method.key === 'all') {
        totals[method.key] = {
          count: records.length,
          amount: records.reduce((sum, r) => sum + (r.total_amount || 0), 0),
          liters: records.reduce((sum, r) => sum + (r.total_liters || 0), 0)
        };
      } else {
        const filtered = records.filter(r => 
          r.payment_method?.toLowerCase().includes(method.key.toLowerCase())
        );
        totals[method.key] = {
          count: filtered.length,
          amount: filtered.reduce((sum, r) => sum + (r.total_amount || 0), 0),
          liters: filtered.reduce((sum, r) => sum + (r.total_liters || 0), 0)
        };
      }
    });
    
    return totals;
  }, [records]);

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const getPaymentIcon = (method: string | null) => {
    if (!method) return <Receipt className="w-4 h-4" />;
    const lower = method.toLowerCase();
    if (lower.includes('pix')) return <Smartphone className="w-4 h-4 text-green-500" />;
    if (lower.includes('dinheiro')) return <Banknote className="w-4 h-4 text-green-600" />;
    if (lower.includes('debito') || lower.includes('débito')) return <CreditCard className="w-4 h-4 text-blue-500" />;
    if (lower.includes('credito') || lower.includes('crédito')) return <CreditCard className="w-4 h-4 text-purple-500" />;
    if (lower.includes('voucher')) return <Receipt className="w-4 h-4 text-orange-500" />;
    return <Receipt className="w-4 h-4" />;
  };

  const getRatingStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star} 
            className={`w-3 h-3 ${star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
          />
        ))}
      </div>
    );
  };

  const exportExcel = () => {
    // Prepare data rows
    const data = filteredRecords.map(r => ({
      'Data/Hora': format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      'Telefone': r.phone,
      'Cliente': r.customer_name || '-',
      'Código Frentista': r.attendant_code || '-',
      'Nome Frentista': r.attendant_name || '-',
      'Litros': r.liters || 0,
      'Valor (R$)': r.amount || 0,
      'Forma Pagamento': r.payment_method || '-',
      'Origem': r.origin === 'pwa' ? 'QR Code' : r.origin || '-',
      'Avaliação': r.customer_rating ? `${r.customer_rating} estrelas` : '-',
      'Total Visitas': r.total_visits,
      'Total Gasto (R$)': r.total_amount,
      'Total Litros': r.total_liters
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Define column widths for better readability
    const colWidths = [
      { wch: 16 }, // Data/Hora
      { wch: 14 }, // Telefone
      { wch: 20 }, // Cliente
      { wch: 14 }, // Código Frentista
      { wch: 20 }, // Nome Frentista
      { wch: 10 }, // Litros
      { wch: 12 }, // Valor (R$)
      { wch: 14 }, // Forma Pagamento
      { wch: 10 }, // Origem
      { wch: 12 }, // Avaliação
      { wch: 12 }, // Total Visitas
      { wch: 14 }, // Total Gasto (R$)
      { wch: 12 }, // Total Litros
    ];
    ws['!cols'] = colWidths;

    // Add number formatting for currency and decimal columns
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      // Litros column (F)
      const litrosCell = XLSX.utils.encode_cell({ r: R, c: 5 });
      if (ws[litrosCell]) ws[litrosCell].z = '#,##0.00';
      
      // Valor column (G)
      const valorCell = XLSX.utils.encode_cell({ r: R, c: 6 });
      if (ws[valorCell]) ws[valorCell].z = 'R$ #,##0.00';
      
      // Total Gasto column (L)
      const totalGastoCell = XLSX.utils.encode_cell({ r: R, c: 11 });
      if (ws[totalGastoCell]) ws[totalGastoCell].z = 'R$ #,##0.00';
      
      // Total Litros column (M)
      const totalLitrosCell = XLSX.utils.encode_cell({ r: R, c: 12 });
      if (ws[totalLitrosCell]) ws[totalLitrosCell].z = '#,##0.00';
    }

    // Create summary sheet
    const summaryData = [
      { 'Resumo': 'Total de Clientes', 'Valor': tabTotals[selectedTab]?.count || 0 },
      { 'Resumo': 'Total Vendido (R$)', 'Valor': tabTotals[selectedTab]?.amount || 0 },
      { 'Resumo': 'Total de Litros', 'Valor': tabTotals[selectedTab]?.liters || 0 },
      { 'Resumo': 'Período', 'Valor': `${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}` },
      { 'Resumo': 'Filtro Pagamento', 'Valor': PAYMENT_METHODS.find(m => m.key === selectedTab)?.label || 'Todos' },
      { 'Resumo': 'Data do Relatório', 'Valor': format(new Date(), 'dd/MM/yyyy HH:mm') },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 30 }];

    // Format currency in summary
    const valorVendidoCell = 'B2';
    if (wsSummary[valorVendidoCell]) wsSummary[valorVendidoCell].z = 'R$ #,##0.00';
    const totalLitrosSummaryCell = 'B3';
    if (wsSummary[totalLitrosSummaryCell]) wsSummary[totalLitrosSummaryCell].z = '#,##0.00';

    // Create payment breakdown sheet
    const paymentBreakdown = PAYMENT_METHODS.filter(m => m.key !== 'all').map(method => ({
      'Forma de Pagamento': method.label,
      'Clientes': tabTotals[method.key]?.count || 0,
      'Total Vendido (R$)': tabTotals[method.key]?.amount || 0,
      'Total Litros': tabTotals[method.key]?.liters || 0
    }));
    const wsPayments = XLSX.utils.json_to_sheet(paymentBreakdown);
    wsPayments['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 12 }];
    
    // Format payment breakdown
    const paymentRange = XLSX.utils.decode_range(wsPayments['!ref'] || 'A1');
    for (let R = paymentRange.s.r + 1; R <= paymentRange.e.r; ++R) {
      const totalVendidoCell = XLSX.utils.encode_cell({ r: R, c: 2 });
      if (wsPayments[totalVendidoCell]) wsPayments[totalVendidoCell].z = 'R$ #,##0.00';
      const litrosCell = XLSX.utils.encode_cell({ r: R, c: 3 });
      if (wsPayments[litrosCell]) wsPayments[litrosCell].z = '#,##0.00';
    }

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
    XLSX.utils.book_append_sheet(wb, ws, 'Produção');
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Por Pagamento');

    // Generate and download file
    const fileName = `relatorio_producao_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <AdminLayout title="Relatório de Produção">
      <div className="space-y-6">
        {/* Header with filters */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                Planilha de Produção
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button onClick={exportExcel} variant="default" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-9 w-40"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-9 w-40"
                  />
                </div>
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Telefone, cliente ou frentista..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for payment methods */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {PAYMENT_METHODS.map(method => {
              const total = tabTotals[method.key];
              return (
                <TabsTrigger 
                  key={method.key} 
                  value={method.key}
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <method.icon className="w-4 h-4" />
                  <span>{method.label}</span>
                  <Badge variant="secondary" className="text-xs ml-1">
                    {total?.count || 0}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="text-2xl font-bold">{tabTotals[selectedTab]?.count || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Vendido</p>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {(tabTotals[selectedTab]?.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Fuel className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Litros</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(tabTotals[selectedTab]?.liters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Spreadsheet table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-foreground w-[140px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Data/Hora
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground w-[130px]">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          Telefone
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Cliente
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground w-[150px]">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Frentista
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground text-right w-[80px]">
                        <div className="flex items-center gap-1 justify-end">
                          <Fuel className="w-3 h-3" />
                          Litros
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground text-right w-[100px]">
                        <div className="flex items-center gap-1 justify-end">
                          <DollarSign className="w-3 h-3" />
                          Valor
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground w-[100px]">
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          Pagamento
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground w-[80px]">
                        <div className="flex items-center gap-1">
                          <QrCode className="w-3 h-3" />
                          Origem
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground w-[90px]">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Nota
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground text-center w-[60px]">Visitas</TableHead>
                      <TableHead className="font-bold text-foreground text-right w-[100px]">Acumulado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                          Carregando dados...
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record, index) => (
                        <TableRow 
                          key={record.id} 
                          className={index % 2 === 0 ? 'bg-muted/30' : ''}
                        >
                          <TableCell className="font-mono text-xs">
                            {format(new Date(record.created_at), 'dd/MM/yy HH:mm')}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPhone(record.phone)}
                          </TableCell>
                          <TableCell>
                            {record.customer_name ? (
                              <span className="font-medium">{record.customer_name}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Não identificado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              {record.attendant_name ? (
                                <span className="font-medium text-sm">{record.attendant_name}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                              {record.attendant_code && (
                                <Badge variant="outline" className="w-fit text-xs mt-0.5">
                                  {record.attendant_code}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {record.liters?.toFixed(1) || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-green-600">
                            {record.amount ? `R$ ${record.amount.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {getPaymentIcon(record.payment_method)}
                              <span className="text-xs capitalize">
                                {record.payment_method || '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.origin === 'pwa' ? (
                              <Badge variant="default" className="text-xs">
                                <QrCode className="w-3 h-3 mr-1" />
                                QR
                              </Badge>
                            ) : record.origin === 'stone' ? (
                              <Badge variant="secondary" className="text-xs">Stone</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getRatingStars(record.customer_rating)}
                          </TableCell>
                          <TableCell className="text-center">
                            {record.total_visits > 1 ? (
                              <Badge variant="outline" className="font-mono">
                                {record.total_visits}x
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">1</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-xs font-medium text-green-600">
                                R$ {record.total_amount.toFixed(2)}
                              </span>
                              <span className="font-mono text-xs text-blue-600">
                                {record.total_liters.toFixed(1)} L
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

