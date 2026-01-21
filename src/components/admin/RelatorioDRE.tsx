import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface LancamentoCaixa {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  valor: number;
}

interface LinhaDRE {
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa' | 'subtotal' | 'resultado';
  indent?: boolean;
}

const GRUPO_RECEITAS = {
  'Receita Operacional Bruta': ['Venda de Combustível', 'Venda de Produtos', 'Serviços'],
  'Outras Receitas': ['Receita Financeira', 'Outros Recebimentos']
};

const GRUPO_DESPESAS = {
  'Custo das Mercadorias Vendidas (CMV)': ['Compra de Combustível', 'Compra de Produtos'],
  'Despesas Operacionais': ['Salários e Encargos', 'Energia Elétrica', 'Água e Esgoto', 'Aluguel', 'Manutenção', 'Material de Limpeza'],
  'Despesas Tributárias': ['Impostos e Taxas'],
  'Despesas Financeiras': ['Despesas Bancárias'],
  'Outras Despesas': ['Outras Despesas']
};

export default function RelatorioDRE() {
  const [open, setOpen] = useState(false);
  const [periodo, setPeriodo] = useState<'mes' | 'ano'>('mes');
  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [lancamentos, setLancamentos] = useState<LancamentoCaixa[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLancamentos = async () => {
    setLoading(true);
    let inicio: string, fim: string;

    if (periodo === 'mes') {
      inicio = format(startOfMonth(mesSelecionado), 'yyyy-MM-dd');
      fim = format(endOfMonth(mesSelecionado), 'yyyy-MM-dd');
    } else {
      const anoRef = new Date(anoSelecionado, 0, 1);
      inicio = format(startOfYear(anoRef), 'yyyy-MM-dd');
      fim = format(endOfYear(anoRef), 'yyyy-MM-dd');
    }

    const { data } = await supabase
      .from('livro_caixa')
      .select('id, data, tipo, categoria, valor')
      .gte('data', inicio)
      .lte('data', fim);

    setLancamentos((data as LancamentoCaixa[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchLancamentos();
    }
  }, [open, periodo, mesSelecionado, anoSelecionado]);

  const dreData = useMemo(() => {
    const linhas: LinhaDRE[] = [];
    const valorPorCategoria: Record<string, number> = {};

    // Agrupar valores por categoria
    lancamentos.forEach(l => {
      valorPorCategoria[l.categoria] = (valorPorCategoria[l.categoria] || 0) + Number(l.valor);
    });

    // RECEITAS
    let totalReceitaBruta = 0;
    Object.entries(GRUPO_RECEITAS).forEach(([grupo, categorias]) => {
      const totalGrupo = categorias.reduce((acc, cat) => acc + (valorPorCategoria[cat] || 0), 0);
      if (totalGrupo > 0) {
        linhas.push({ descricao: grupo, valor: totalGrupo, tipo: 'receita' });
        categorias.forEach(cat => {
          const val = valorPorCategoria[cat] || 0;
          if (val > 0) {
            linhas.push({ descricao: cat, valor: val, tipo: 'receita', indent: true });
          }
        });
        totalReceitaBruta += totalGrupo;
      }
    });

    linhas.push({ descricao: 'RECEITA BRUTA TOTAL', valor: totalReceitaBruta, tipo: 'subtotal' });

    // DESPESAS (CMV primeiro)
    let cmv = 0;
    const catCMV = GRUPO_DESPESAS['Custo das Mercadorias Vendidas (CMV)'];
    catCMV.forEach(cat => {
      cmv += valorPorCategoria[cat] || 0;
    });

    if (cmv > 0) {
      linhas.push({ descricao: '(-) Custo das Mercadorias Vendidas (CMV)', valor: -cmv, tipo: 'despesa' });
      catCMV.forEach(cat => {
        const val = valorPorCategoria[cat] || 0;
        if (val > 0) {
          linhas.push({ descricao: cat, valor: -val, tipo: 'despesa', indent: true });
        }
      });
    }

    const lucroOperacionalBruto = totalReceitaBruta - cmv;
    linhas.push({ descricao: 'LUCRO OPERACIONAL BRUTO', valor: lucroOperacionalBruto, tipo: 'subtotal' });

    // Despesas Operacionais e outras
    let totalDespesasOp = 0;
    Object.entries(GRUPO_DESPESAS).forEach(([grupo, categorias]) => {
      if (grupo === 'Custo das Mercadorias Vendidas (CMV)') return;

      const totalGrupo = categorias.reduce((acc, cat) => acc + (valorPorCategoria[cat] || 0), 0);
      if (totalGrupo > 0) {
        linhas.push({ descricao: `(-) ${grupo}`, valor: -totalGrupo, tipo: 'despesa' });
        categorias.forEach(cat => {
          const val = valorPorCategoria[cat] || 0;
          if (val > 0) {
            linhas.push({ descricao: cat, valor: -val, tipo: 'despesa', indent: true });
          }
        });
        totalDespesasOp += totalGrupo;
      }
    });

    const lucroLiquido = lucroOperacionalBruto - totalDespesasOp;
    linhas.push({ descricao: 'RESULTADO LÍQUIDO DO PERÍODO', valor: lucroLiquido, tipo: 'resultado' });

    return linhas;
  }, [lancamentos]);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const periodoLabel = periodo === 'mes' 
    ? format(mesSelecionado, 'MMMM/yyyy', { locale: ptBR })
    : `Ano ${anoSelecionado}`;

  const exportToExcel = () => {
    const dataExport = dreData.map(linha => ({
      'Descrição': linha.indent ? `   ${linha.descricao}` : linha.descricao,
      'Valor': linha.valor
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DRE');
    XLSX.writeFile(wb, `DRE-${periodoLabel.replace('/', '-')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Relatório DRE
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Demonstrativo de Resultado do Exercício (DRE)
          </DialogTitle>
          <p className="sr-only">Relatório financeiro com receitas e despesas do período selecionado</p>
        </DialogHeader>

        <div className="print:hidden flex flex-wrap gap-4 items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={periodo} onValueChange={(v: 'mes' | 'ano') => setPeriodo(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mensal</SelectItem>
                <SelectItem value="ano">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodo === 'mes' ? (
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
          ) : (
            <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => {
                  const ano = new Date().getFullYear() - i;
                  return <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Header para impressão */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-xl font-bold">DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO</h1>
          <p className="text-sm text-muted-foreground">Período: {periodoLabel}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70%]">Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dreData.map((linha, index) => (
                <TableRow 
                  key={index}
                  className={cn(
                    linha.tipo === 'subtotal' && 'bg-muted/50 font-semibold',
                    linha.tipo === 'resultado' && 'bg-primary/10 font-bold text-lg'
                  )}
                >
                  <TableCell className={cn(linha.indent && 'pl-8 text-muted-foreground')}>
                    {linha.descricao}
                  </TableCell>
                  <TableCell 
                    className={cn(
                      'text-right font-mono',
                      linha.valor > 0 && linha.tipo === 'resultado' && 'text-green-600',
                      linha.valor < 0 && linha.tipo === 'resultado' && 'text-red-600',
                      linha.tipo === 'despesa' && !linha.indent && 'text-red-600'
                    )}
                  >
                    {formatCurrency(linha.valor)}
                  </TableCell>
                </TableRow>
              ))}
              {dreData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado para o período selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <Separator className="my-4 print:hidden" />

        <div className="text-xs text-muted-foreground print:hidden">
          <p><strong>Legenda:</strong></p>
          <p>• Receita Operacional Bruta = Vendas de combustível, produtos e serviços</p>
          <p>• CMV = Custo da aquisição de combustível e produtos para revenda</p>
          <p>• Lucro Operacional Bruto = Receita Bruta - CMV</p>
          <p>• Resultado Líquido = Lucro Operacional Bruto - Despesas Operacionais</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
