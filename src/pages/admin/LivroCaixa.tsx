import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO, subMonths, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Download, 
  Upload, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar as CalendarIcon,
  Trash2,
  Pencil,
  FileSpreadsheet,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  RefreshCw,
  Users,
  Fuel
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import RelatorioDRE from '@/components/admin/RelatorioDRE';

interface LancamentoCaixa {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string | null;
  valor: number;
  forma_pagamento: string | null;
  responsavel: string | null;
  observacoes: string | null;
  created_at: string;
}

interface DadosMensais {
  mes: string;
  mesCompleto: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

interface Frentista {
  id: string;
  nome: string;
  codigo: string;
}

interface StoneTefLog {
  id: string;
  horario: string;
  valor: number;
  forma_pagamento: string;
  frentista_id: string | null;
  frentista_nome: string | null;
  bandeira: string | null;
  status: string | null;
}

interface DemonstrativoDiario {
  data: string;
  frentistas: {
    [frentista: string]: {
      pix: number;
      dinheiro: number;
      credito: number;
      debito: number;
      total: number;
    };
  };
  totais: {
    pix: number;
    dinheiro: number;
    credito: number;
    debito: number;
    total: number;
  };
}

const CATEGORIAS_ENTRADA = [
  'Venda de Combustível',
  'Venda de Produtos',
  'Serviços',
  'Receita Financeira',
  'Outros Recebimentos'
];

const CATEGORIAS_SAIDA = [
  'Compra de Combustível',
  'Compra de Produtos',
  'Salários e Encargos',
  'Energia Elétrica',
  'Água e Esgoto',
  'Aluguel',
  'Manutenção',
  'Material de Limpeza',
  'Impostos e Taxas',
  'Despesas Bancárias',
  'Outras Despesas'
];

const FORMAS_PAGAMENTO = [
  'Dinheiro',
  'PIX',
  'Cartão Débito',
  'Cartão Crédito',
  'Boleto',
  'Transferência'
];

export default function LivroCaixa() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<LancamentoCaixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dadosGrafico, setDadosGrafico] = useState<DadosMensais[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [frentistas, setFrentistas] = useState<Frentista[]>([]);
  const [stoneTefLogs, setStoneTefLogs] = useState<StoneTefLog[]>([]);
  const [loadingTef, setLoadingTef] = useState(false);
  const [activeTab, setActiveTab] = useState('demonstrativo');
  const [filtroFrentista, setFiltroFrentista] = useState<string>('todos');

  // Form state
  const [formData, setFormData] = useState({
    data: new Date(),
    tipo: 'entrada' as 'entrada' | 'saida',
    categoria: '',
    descricao: '',
    valor: '',
    forma_pagamento: '',
    responsavel: '',
    observacoes: ''
  });

  const fetchFrentistas = async () => {
    const { data } = await supabase
      .from('frentistas')
      .select('id, nome, codigo')
      .eq('is_active', true)
      .order('nome');
    setFrentistas(data || []);
  };

  const fetchStoneTefLogs = async () => {
    setLoadingTef(true);
    const inicio = format(startOfDay(dataSelecionada), "yyyy-MM-dd'T'HH:mm:ss");
    const fim = format(endOfDay(dataSelecionada), "yyyy-MM-dd'T'HH:mm:ss");

    const { data, error } = await supabase
      .from('stone_tef_logs')
      .select('*')
      .gte('horario', inicio)
      .lte('horario', fim)
      .eq('status', 'aprovado')
      .order('horario', { ascending: true });

    if (error) {
      console.error('Erro ao buscar TEF logs:', error);
    } else {
      setStoneTefLogs(data || []);
    }
    setLoadingTef(false);
  };

  const fetchLancamentos = async () => {
    setLoading(true);
    const inicio = format(startOfMonth(mesSelecionado), 'yyyy-MM-dd');
    const fim = format(endOfMonth(mesSelecionado), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('livro_caixa')
      .select('*')
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false });

    if (error) {
      console.error('Erro ao buscar lançamentos:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar lançamentos.', variant: 'destructive' });
    } else {
      setLancamentos((data as LancamentoCaixa[]) || []);
    }
    setLoading(false);
  };

  const fetchDadosGrafico = async () => {
    const meses: DadosMensais[] = [];
    const hoje = new Date();

    for (let i = 5; i >= 0; i--) {
      const mesRef = subMonths(hoje, i);
      const inicio = format(startOfMonth(mesRef), 'yyyy-MM-dd');
      const fim = format(endOfMonth(mesRef), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('livro_caixa')
        .select('tipo, valor')
        .gte('data', inicio)
        .lte('data', fim);

      const entradas = (data || []).filter(l => l.tipo === 'entrada').reduce((acc, l) => acc + Number(l.valor), 0);
      const saidas = (data || []).filter(l => l.tipo === 'saida').reduce((acc, l) => acc + Number(l.valor), 0);

      meses.push({
        mes: format(mesRef, 'MMM', { locale: ptBR }).toUpperCase(),
        mesCompleto: format(mesRef, 'MMMM/yyyy', { locale: ptBR }),
        entradas,
        saidas,
        saldo: entradas - saidas
      });
    }

    setDadosGrafico(meses);
  };

  useEffect(() => {
    fetchFrentistas();
  }, []);

  useEffect(() => {
    fetchLancamentos();
  }, [mesSelecionado]);

  useEffect(() => {
    fetchStoneTefLogs();
  }, [dataSelecionada]);

  useEffect(() => {
    fetchDadosGrafico();
  }, []);

  // Processar dados do demonstrativo diário baseado nos TEF logs
  const demonstrativoDiario = useMemo((): DemonstrativoDiario => {
    const resultado: DemonstrativoDiario = {
      data: format(dataSelecionada, 'yyyy-MM-dd'),
      frentistas: {},
      totais: { pix: 0, dinheiro: 0, credito: 0, debito: 0, total: 0 }
    };

    // Inicializar frentistas
    frentistas.forEach(f => {
      resultado.frentistas[f.nome] = { pix: 0, dinheiro: 0, credito: 0, debito: 0, total: 0 };
    });
    resultado.frentistas['Não identificado'] = { pix: 0, dinheiro: 0, credito: 0, debito: 0, total: 0 };

    // Filtrar logs pelo frentista selecionado
    const logsFiltrados = filtroFrentista === 'todos' 
      ? stoneTefLogs 
      : stoneTefLogs.filter(log => {
          const nome = log.frentista_nome || 'Não identificado';
          return nome === filtroFrentista;
        });

    // Processar transações TEF
    logsFiltrados.forEach(log => {
      const frentistaNome = log.frentista_nome || 'Não identificado';
      const valor = Number(log.valor);
      const formaPgto = (log.forma_pagamento || '').toLowerCase();

      if (!resultado.frentistas[frentistaNome]) {
        resultado.frentistas[frentistaNome] = { pix: 0, dinheiro: 0, credito: 0, debito: 0, total: 0 };
      }

      // Mapear formas de pagamento
      if (formaPgto.includes('pix')) {
        resultado.frentistas[frentistaNome].pix += valor;
        resultado.totais.pix += valor;
      } else if (formaPgto.includes('dinheiro') || formaPgto.includes('especie')) {
        resultado.frentistas[frentistaNome].dinheiro += valor;
        resultado.totais.dinheiro += valor;
      } else if (formaPgto.includes('credito') || formaPgto.includes('crédito')) {
        resultado.frentistas[frentistaNome].credito += valor;
        resultado.totais.credito += valor;
      } else if (formaPgto.includes('debito') || formaPgto.includes('débito')) {
        resultado.frentistas[frentistaNome].debito += valor;
        resultado.totais.debito += valor;
      } else {
        // Default para débito se não identificado
        resultado.frentistas[frentistaNome].debito += valor;
        resultado.totais.debito += valor;
      }

      resultado.frentistas[frentistaNome].total += valor;
      resultado.totais.total += valor;
    });

    return resultado;
  }, [stoneTefLogs, frentistas, dataSelecionada, filtroFrentista]);

  const resetForm = () => {
    setFormData({
      data: new Date(),
      tipo: 'entrada',
      categoria: '',
      descricao: '',
      valor: '',
      forma_pagamento: '',
      responsavel: '',
      observacoes: ''
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoria || !formData.valor) {
      toast({ title: 'Erro', description: 'Preencha categoria e valor.', variant: 'destructive' });
      return;
    }

    const payload = {
      data: format(formData.data, 'yyyy-MM-dd'),
      tipo: formData.tipo,
      categoria: formData.categoria,
      descricao: formData.descricao || null,
      valor: parseFloat(formData.valor.replace(',', '.')),
      forma_pagamento: formData.forma_pagamento || null,
      responsavel: formData.responsavel || null,
      observacoes: formData.observacoes || null,
      created_by: user?.id
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from('livro_caixa')
        .update(payload)
        .eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('livro_caixa')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      console.error('Erro ao salvar:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar lançamento.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: editingId ? 'Lançamento atualizado!' : 'Lançamento criado!' });
      setDialogOpen(false);
      resetForm();
      fetchLancamentos();
      fetchDadosGrafico();
    }
  };

  const handleEdit = (lancamento: LancamentoCaixa) => {
    setFormData({
      data: parseISO(lancamento.data),
      tipo: lancamento.tipo,
      categoria: lancamento.categoria,
      descricao: lancamento.descricao || '',
      valor: lancamento.valor.toString(),
      forma_pagamento: lancamento.forma_pagamento || '',
      responsavel: lancamento.responsavel || '',
      observacoes: lancamento.observacoes || ''
    });
    setEditingId(lancamento.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    const { error } = await supabase.from('livro_caixa').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Lançamento excluído!' });
      fetchLancamentos();
      fetchDadosGrafico();
    }
  };

  const exportDemonstrativoToExcel = () => {
    const rows: any[] = [];
    
    // Cabeçalho
    rows.push({
      'DEMONSTRATIVO DE CAIXA DIÁRIO': '',
      '': '',
      'Data': format(dataSelecionada, 'dd/MM/yyyy'),
    });
    rows.push({});
    
    // Cabeçalho das colunas
    rows.push({
      'Frentista': 'FRENTISTA',
      'PIX': 'PIX (R$)',
      'Dinheiro': 'DINHEIRO (R$)',
      'Crédito': 'CRÉDITO (R$)',
      'Débito': 'DÉBITO (R$)',
      'Total': 'TOTAL (R$)'
    });

    // Dados por frentista
    Object.entries(demonstrativoDiario.frentistas).forEach(([nome, valores]) => {
      if (valores.total > 0) {
        rows.push({
          'Frentista': nome,
          'PIX': valores.pix,
          'Dinheiro': valores.dinheiro,
          'Crédito': valores.credito,
          'Débito': valores.debito,
          'Total': valores.total
        });
      }
    });

    // Linha de totais
    rows.push({
      'Frentista': 'TOTAL GERAL',
      'PIX': demonstrativoDiario.totais.pix,
      'Dinheiro': demonstrativoDiario.totais.dinheiro,
      'Crédito': demonstrativoDiario.totais.credito,
      'Débito': demonstrativoDiario.totais.debito,
      'Total': demonstrativoDiario.totais.total
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Demonstrativo Diário');
    
    XLSX.writeFile(wb, `demonstrativo-caixa-${format(dataSelecionada, 'dd-MM-yyyy')}.xlsx`);
    toast({ title: 'Exportado', description: 'Demonstrativo Excel gerado!' });
  };

  const exportToExcel = () => {
    const dataExport = lancamentos.map(l => ({
      'Data': format(parseISO(l.data), 'dd/MM/yyyy'),
      'Tipo': l.tipo === 'entrada' ? 'Entrada' : 'Saída',
      'Categoria': l.categoria,
      'Descrição': l.descricao || '',
      'Valor': l.valor,
      'Forma Pagamento': l.forma_pagamento || '',
      'Responsável': l.responsavel || '',
      'Observações': l.observacoes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Livro Caixa');
    
    const mesAno = format(mesSelecionado, 'MM-yyyy');
    XLSX.writeFile(wb, `livro-caixa-${mesAno}.xlsx`);
    
    toast({ title: 'Exportado', description: 'Arquivo Excel gerado com sucesso!' });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        let imported = 0;
        for (const row of jsonData as any[]) {
          const dataStr = row['Data'] || row['data'];
          const tipoStr = (row['Tipo'] || row['tipo'] || '').toLowerCase();
          const categoria = row['Categoria'] || row['categoria'];
          const valorStr = row['Valor'] || row['valor'];

          if (!dataStr || !categoria || !valorStr) continue;

          let parsedDate: Date;
          if (typeof dataStr === 'string' && dataStr.includes('/')) {
            const [d, m, y] = dataStr.split('/');
            parsedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          } else if (typeof dataStr === 'number') {
            parsedDate = new Date((dataStr - 25569) * 86400 * 1000);
          } else {
            parsedDate = new Date(dataStr);
          }

          const tipo = tipoStr.includes('entrada') ? 'entrada' : 'saida';
          const valor = typeof valorStr === 'number' ? valorStr : parseFloat(String(valorStr).replace(',', '.'));

          await supabase.from('livro_caixa').insert({
            data: format(parsedDate, 'yyyy-MM-dd'),
            tipo,
            categoria,
            descricao: row['Descrição'] || row['descricao'] || null,
            valor,
            forma_pagamento: row['Forma Pagamento'] || row['forma_pagamento'] || null,
            responsavel: row['Responsável'] || row['responsavel'] || null,
            observacoes: row['Observações'] || row['observacoes'] || null,
            created_by: user?.id
          });
          imported++;
        }

        toast({ title: 'Importação concluída', description: `${imported} lançamentos importados.` });
        fetchLancamentos();
        fetchDadosGrafico();
      } catch (err) {
        console.error('Erro na importação:', err);
        toast({ title: 'Erro', description: 'Erro ao importar arquivo.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Cálculos
  const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada').reduce((acc, l) => acc + Number(l.valor), 0);
  const totalSaidas = lancamentos.filter(l => l.tipo === 'saida').reduce((acc, l) => acc + Number(l.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  const categorias = formData.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <AdminLayout title="Livro Caixa">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="demonstrativo" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Demonstrativo</span>
            </TabsTrigger>
            <TabsTrigger value="notas" className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Notas Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="saidas" className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Saídas</span>
            </TabsTrigger>
            <TabsTrigger value="lancamentos" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamentos</span>
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Evolução</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Demonstrativo Diário */}
          <TabsContent value="demonstrativo" className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-48 justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dataSelecionada, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dataSelecionada}
                        onSelect={(d) => d && setDataSelecionada(d)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <Select value={filtroFrentista} onValueChange={setFiltroFrentista}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar frentista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os frentistas</SelectItem>
                      {frentistas.map((f) => (
                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                      ))}
                      <SelectItem value="Não identificado">Não identificado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchStoneTefLogs} disabled={loadingTef}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingTef && "animate-spin")} />
                  Atualizar
                </Button>
                <Button variant="outline" onClick={exportDemonstrativoToExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </div>

            {/* Cards de Resumo do Dia */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">PIX</CardTitle>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600">PIX</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">R$ {formatCurrency(demonstrativoDiario.totais.pix)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dinheiro</CardTitle>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">$</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">R$ {formatCurrency(demonstrativoDiario.totais.dinheiro)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Crédito</CardTitle>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600">CC</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">R$ {formatCurrency(demonstrativoDiario.totais.credito)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Débito</CardTitle>
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-600">CD</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">R$ {formatCurrency(demonstrativoDiario.totais.debito)}</div>
                </CardContent>
              </Card>
              <Card className="bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
                  <Fuel className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-primary">R$ {formatCurrency(demonstrativoDiario.totais.total)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Resumo de Saldo Diário do Mês */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Saldo Diário - {format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold">Data</TableHead>
                          <TableHead className="text-right font-bold text-green-600">Entradas (R$)</TableHead>
                          <TableHead className="text-right font-bold text-red-600">Saídas (R$)</TableHead>
                          <TableHead className="text-right font-bold text-primary">Saldo (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const diasDoMes = eachDayOfInterval({
                            start: startOfMonth(mesSelecionado),
                            end: endOfMonth(mesSelecionado) > new Date() ? new Date() : endOfMonth(mesSelecionado)
                          });
                          
                          let saldoAcumulado = 0;
                          const resumoDiario = diasDoMes.map(dia => {
                            const diaStr = format(dia, 'yyyy-MM-dd');
                            const entradasDia = lancamentos
                              .filter(l => l.data === diaStr && l.tipo === 'entrada')
                              .reduce((acc, l) => acc + Number(l.valor), 0);
                            const saidasDia = lancamentos
                              .filter(l => l.data === diaStr && l.tipo === 'saida')
                              .reduce((acc, l) => acc + Number(l.valor), 0);
                            const saldoDia = entradasDia - saidasDia;
                            saldoAcumulado += saldoDia;
                            
                            return { dia, diaStr, entradasDia, saidasDia, saldoDia, saldoAcumulado };
                          });

                          const diasComMovimento = resumoDiario.filter(d => d.entradasDia > 0 || d.saidasDia > 0);
                          
                          if (diasComMovimento.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  Nenhum lançamento registrado neste mês.
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return diasComMovimento.map((d) => (
                            <TableRow key={d.diaStr} className="hover:bg-muted/30">
                              <TableCell className="font-medium">
                                {format(d.dia, "dd/MM (EEE)", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">
                                {d.entradasDia > 0 ? formatCurrency(d.entradasDia) : '-'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">
                                {d.saidasDia > 0 ? formatCurrency(d.saidasDia) : '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right tabular-nums font-medium",
                                d.saldoDia > 0 ? "text-green-600" : d.saldoDia < 0 ? "text-red-600" : "text-muted-foreground"
                              )}>
                                {d.saldoDia > 0 ? '+' : ''}{formatCurrency(d.saldoDia)}
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                        {/* Linha de Total Mensal */}
                        {lancamentos.length > 0 && (
                          <TableRow className="bg-muted font-bold border-t-2 sticky bottom-0">
                            <TableCell className="font-bold">TOTAL MÊS</TableCell>
                            <TableCell className="text-right tabular-nums text-green-600 font-bold">
                              {formatCurrency(totalEntradas)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-600 font-bold">
                              {formatCurrency(totalSaidas)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums font-bold",
                              saldo >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {saldo >= 0 ? '+' : ''}{formatCurrency(saldo)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela Demonstrativo por Frentista (Estilo Planilha) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Demonstrativo de Caixa - {format(dataSelecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTef ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold">FRENTISTA</TableHead>
                          <TableHead className="text-right font-bold text-purple-600">PIX (R$)</TableHead>
                          <TableHead className="text-right font-bold text-green-600">DINHEIRO (R$)</TableHead>
                          <TableHead className="text-right font-bold text-blue-600">CRÉDITO (R$)</TableHead>
                          <TableHead className="text-right font-bold text-orange-600">DÉBITO (R$)</TableHead>
                          <TableHead className="text-right font-bold bg-primary/10">TOTAL (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(demonstrativoDiario.frentistas)
                          .filter(([_, valores]) => valores.total > 0)
                          .map(([nome, valores]) => (
                            <TableRow key={nome} className="hover:bg-muted/30">
                              <TableCell className="font-medium">{nome}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(valores.pix)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(valores.dinheiro)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(valores.credito)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(valores.debito)}</TableCell>
                              <TableCell className="text-right tabular-nums font-bold bg-primary/5">{formatCurrency(valores.total)}</TableCell>
                            </TableRow>
                          ))}
                        {Object.values(demonstrativoDiario.frentistas).every(v => v.total === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Nenhuma transação registrada neste dia.
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Linha de Total */}
                        {demonstrativoDiario.totais.total > 0 && (
                          <TableRow className="bg-muted font-bold border-t-2">
                            <TableCell className="font-bold">TOTAL GERAL</TableCell>
                            <TableCell className="text-right tabular-nums text-purple-600">{formatCurrency(demonstrativoDiario.totais.pix)}</TableCell>
                            <TableCell className="text-right tabular-nums text-green-600">{formatCurrency(demonstrativoDiario.totais.dinheiro)}</TableCell>
                            <TableCell className="text-right tabular-nums text-blue-600">{formatCurrency(demonstrativoDiario.totais.credito)}</TableCell>
                            <TableCell className="text-right tabular-nums text-orange-600">{formatCurrency(demonstrativoDiario.totais.debito)}</TableCell>
                            <TableCell className="text-right tabular-nums font-bold text-primary bg-primary/10">{formatCurrency(demonstrativoDiario.totais.total)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Notas de Clientes (Entradas) */}
          <TabsContent value="notas" className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <Select
                  value={format(mesSelecionado, 'yyyy-MM')}
                  onValueChange={(val) => {
                    const [year, month] = val.split('-');
                    setMesSelecionado(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() - i);
                      return (
                        <SelectItem key={i} value={format(d, 'yyyy-MM')}>
                          {format(d, 'MMMM yyyy', { locale: ptBR })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setFormData({ ...formData, tipo: 'entrada' })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Entrada
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>

            {/* Cards resumo Entradas */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-green-500/5 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Venda Combustível</CardTitle>
                  <Fuel className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-600">
                    R$ {formatCurrency(lancamentos.filter(l => l.tipo === 'entrada' && l.categoria === 'Venda de Combustível').reduce((acc, l) => acc + Number(l.valor), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Venda Produtos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-blue-600">
                    R$ {formatCurrency(lancamentos.filter(l => l.tipo === 'entrada' && l.categoria === 'Venda de Produtos').reduce((acc, l) => acc + Number(l.valor), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-purple-500/5 border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Serviços</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-600">
                    R$ {formatCurrency(lancamentos.filter(l => l.tipo === 'entrada' && l.categoria === 'Serviços').reduce((acc, l) => acc + Number(l.valor), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-500/10 border-green-500/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
                  <ArrowUpCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    R$ {formatCurrency(totalEntradas)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Entradas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <ArrowUpCircle className="h-5 w-5" />
                  Notas de Clientes / Entradas - {format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : lancamentos.filter(l => l.tipo === 'entrada').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma entrada registrada neste mês.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-green-500/5">
                          <TableHead>Data</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lancamentos.filter(l => l.tipo === 'entrada').map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{format(parseISO(l.data), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                                {l.categoria}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{l.descricao || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              + R$ {formatCurrency(Number(l.valor))}
                            </TableCell>
                            <TableCell>{l.forma_pagamento || '-'}</TableCell>
                            <TableCell>{l.responsavel || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(l)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Saídas */}
          <TabsContent value="saidas" className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <Select
                  value={format(mesSelecionado, 'yyyy-MM')}
                  onValueChange={(val) => {
                    const [year, month] = val.split('-');
                    setMesSelecionado(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() - i);
                      return (
                        <SelectItem key={i} value={format(d, 'yyyy-MM')}>
                          {format(d, 'MMMM yyyy', { locale: ptBR })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button variant="destructive" onClick={() => setFormData({ ...formData, tipo: 'saida' })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Saída
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>

            {/* Cards resumo Saídas */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-red-500/5 border-red-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compra Combustível</CardTitle>
                  <Fuel className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-600">
                    R$ {formatCurrency(lancamentos.filter(l => l.tipo === 'saida' && l.categoria === 'Compra de Combustível').reduce((acc, l) => acc + Number(l.valor), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-orange-500/5 border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Salários</CardTitle>
                  <Users className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-orange-600">
                    R$ {formatCurrency(lancamentos.filter(l => l.tipo === 'saida' && l.categoria === 'Salários e Encargos').reduce((acc, l) => acc + Number(l.valor), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-500/5 border-yellow-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outras Despesas</CardTitle>
                  <TrendingDown className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-yellow-600">
                    R$ {formatCurrency(lancamentos.filter(l => l.tipo === 'saida' && !['Compra de Combustível', 'Salários e Encargos'].includes(l.categoria)).reduce((acc, l) => acc + Number(l.valor), 0))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-500/10 border-red-500/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
                  <ArrowDownCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    R$ {formatCurrency(totalSaidas)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Saídas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <ArrowDownCircle className="h-5 w-5" />
                  Saídas / Despesas - {format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : lancamentos.filter(l => l.tipo === 'saida').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma saída registrada neste mês.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-red-500/5">
                          <TableHead>Data</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lancamentos.filter(l => l.tipo === 'saida').map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{format(parseISO(l.data), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-red-500/10 text-red-600">
                                {l.categoria}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{l.descricao || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              - R$ {formatCurrency(Number(l.valor))}
                            </TableCell>
                            <TableCell>{l.forma_pagamento || '-'}</TableCell>
                            <TableCell>{l.responsavel || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(l)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Lançamentos Manuais */}
          <TabsContent value="lancamentos" className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <Select
                  value={format(mesSelecionado, 'yyyy-MM')}
                  onValueChange={(val) => {
                    const [year, month] = val.split('-');
                    setMesSelecionado(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() - i);
                      return (
                        <SelectItem key={i} value={format(d, 'yyyy-MM')}>
                          {format(d, 'MMMM yyyy', { locale: ptBR })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Lançamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Data</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(formData.data, 'dd/MM/yyyy')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={formData.data}
                                onSelect={(d) => d && setFormData({ ...formData, data: d })}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Tipo</Label>
                          <Select value={formData.tipo} onValueChange={(v: 'entrada' | 'saida') => setFormData({ ...formData, tipo: v, categoria: '' })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrada">
                                <span className="flex items-center gap-2 text-green-600">
                                  <ArrowUpCircle className="h-4 w-4" /> Entrada
                                </span>
                              </SelectItem>
                              <SelectItem value="saida">
                                <span className="flex items-center gap-2 text-red-600">
                                  <ArrowDownCircle className="h-4 w-4" /> Saída
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>Categoria *</Label>
                        <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categorias.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Valor *</Label>
                          <Input
                            type="text"
                            placeholder="0,00"
                            value={formData.valor}
                            onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Forma de Pagamento</Label>
                          <Select value={formData.forma_pagamento} onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMAS_PAGAMENTO.map((fp) => (
                                <SelectItem key={fp} value={fp}>{fp}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>Descrição</Label>
                        <Input
                          value={formData.descricao}
                          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                          placeholder="Descrição do lançamento"
                        />
                      </div>

                      <div>
                        <Label>Responsável</Label>
                        <Input
                          value={formData.responsavel}
                          onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                          placeholder="Nome do responsável"
                        />
                      </div>

                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={formData.observacoes}
                          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                          placeholder="Observações adicionais..."
                          rows={2}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingId ? 'Atualizar' : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <RelatorioDRE />

                <Button variant="outline" onClick={exportToExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>

                <label>
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Excel
                    </span>
                  </Button>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
                </label>
              </div>
            </div>

            {/* Cards resumo */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
                  <DollarSign className={cn("h-4 w-4", saldo >= 0 ? "text-green-500" : "text-red-500")} />
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", saldo >= 0 ? "text-green-600" : "text-red-600")}>
                    R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de lançamentos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Lançamentos - {format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : lancamentos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado neste mês.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lancamentos.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{format(parseISO(l.data), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={l.tipo === 'entrada' ? 'default' : 'destructive'} className={l.tipo === 'entrada' ? 'bg-green-500' : ''}>
                                {l.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                              </Badge>
                            </TableCell>
                            <TableCell>{l.categoria}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{l.descricao || '-'}</TableCell>
                            <TableCell className={cn("text-right font-medium", l.tipo === 'entrada' ? 'text-green-600' : 'text-red-600')}>
                              {l.tipo === 'entrada' ? '+' : '-'} R$ {Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>{l.forma_pagamento || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(l)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Evolução Financeira */}
          <TabsContent value="evolucao" className="space-y-4">
            {/* Cards resumo */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
                  <DollarSign className={cn("h-4 w-4", saldo >= 0 ? "text-green-500" : "text-red-500")} />
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", saldo >= 0 ? "text-green-600" : "text-red-600")}>
                    R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Evolução Mensal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Evolução Financeira - Últimos 6 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="mes" 
                        tick={{ fontSize: 12 }}
                        className="fill-muted-foreground"
                      />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                        className="fill-muted-foreground"
                      />
                      <Tooltip 
                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                        labelFormatter={(label, payload) => payload[0]?.payload?.mesCompleto || label}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="entradas" 
                        name="Entradas" 
                        fill="#22c55e" 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="saidas" 
                        name="Saídas" 
                        fill="#ef4444" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
