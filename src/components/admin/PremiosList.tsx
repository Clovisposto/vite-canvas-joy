import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QrCode, Search, History, RefreshCw } from 'lucide-react';
import { getPremioPublicUrl } from '@/lib/public-url';

interface Premio {
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

const maskCPF = (cpf: string | null) => {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
};

interface Consumo {
  id: string;
  valor_abatido: number;
  valor_anterior: number;
  valor_apos: number;
  consumido_em: string;
  observacao: string | null;
}

export default function PremiosList() {
  const { toast } = useToast();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedPremio, setSelectedPremio] = useState<Premio | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [loadingConsumos, setLoadingConsumos] = useState(false);

  const fetchPremios = async () => {
    setLoading(true);
    try {
      let query = (supabase.from('premios_qr' as any) as any)
        .select('*')
        .order('data_criacao', { ascending: false });

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPremios((data || []) as Premio[]);
    } catch (error) {
      console.error('Error fetching premios:', error);
      toast({
        title: 'Erro ao carregar prêmios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConsumos = async (premioId: string) => {
    setLoadingConsumos(true);
    try {
      const { data, error } = await (supabase
        .from('premios_qr_consumos' as any) as any)
        .select('*')
        .eq('premio_id', premioId)
        .order('consumido_em', { ascending: false });

      if (error) throw error;
      setConsumos((data || []) as Consumo[]);
    } catch (error) {
      console.error('Error fetching consumos:', error);
      toast({
        title: 'Erro ao carregar histórico',
        variant: 'destructive',
      });
    } finally {
      setLoadingConsumos(false);
    }
  };

  useEffect(() => {
    fetchPremios();
  }, [statusFilter]);

  const filteredPremios = premios.filter(premio =>
    premio.nome_ganhador.toLowerCase().includes(searchTerm.toLowerCase()) ||
    premio.cpf?.includes(searchTerm) ||
    premio.telefone?.includes(searchTerm) ||
    premio.codigo.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
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

  const getPremioUrl = (codigo: string) => {
    return getPremioPublicUrl(codigo);
  };

  const handleShowQR = (premio: Premio) => {
    setSelectedPremio(premio);
    setShowQRDialog(true);
  };

  const handleShowHistory = async (premio: Premio) => {
    setSelectedPremio(premio);
    setShowHistoryDialog(true);
    await fetchConsumos(premio.id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, telefone ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="expirado">Expirados</SelectItem>
            <SelectItem value="zerado">Utilizados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchPremios}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      {filteredPremios.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum prêmio encontrado</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ganhador</TableHead>
                <TableHead>Valor Original</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPremios.map((premio) => (
                <TableRow key={premio.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{premio.nome_ganhador}</p>
                      {premio.cpf && (
                        <p className="text-xs text-muted-foreground">{maskCPF(premio.cpf)}</p>
                      )}
                      {premio.telefone && (
                        <p className="text-xs text-muted-foreground">{premio.telefone}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    R$ {premio.valor_original.toFixed(2).replace('.', ',')}
                  </TableCell>
                  <TableCell>
                    <span className={premio.valor_restante > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                      R$ {premio.valor_restante.toFixed(2).replace('.', ',')}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(premio.status)}</TableCell>
                  <TableCell>
                    {format(new Date(premio.data_expiracao), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShowQR(premio)}
                        title="Ver QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShowHistory(premio)}
                        title="Histórico de consumos"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* QR Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code do Prêmio</DialogTitle>
            <p className="sr-only">Visualize o QR Code do prêmio selecionado para validação</p>
          </DialogHeader>
          {selectedPremio && (
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCodeSVG
                  value={getPremioUrl(selectedPremio.codigo)}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>
              <div>
                <p className="font-medium">{selectedPremio.nome_ganhador}</p>
                {selectedPremio.cpf && (
                  <p className="text-xs text-muted-foreground">CPF: {maskCPF(selectedPremio.cpf)}</p>
                )}
                <p className="text-lg font-bold text-green-600">
                  Saldo: R$ {selectedPremio.valor_restante.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Consumos</DialogTitle>
            <p className="sr-only">Visualize o histórico de consumos e abatimentos do prêmio</p>
          </DialogHeader>
          {selectedPremio && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Ganhador:</strong> {selectedPremio.nome_ganhador}</p>
                {selectedPremio.cpf && (
                  <p><strong>CPF:</strong> {maskCPF(selectedPremio.cpf)}</p>
                )}
                <p><strong>Valor Original:</strong> R$ {selectedPremio.valor_original.toFixed(2).replace('.', ',')}</p>
                <p><strong>Saldo Atual:</strong> R$ {selectedPremio.valor_restante.toFixed(2).replace('.', ',')}</p>
              </div>

              {loadingConsumos ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : consumos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum consumo registrado
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {consumos.map((consumo) => (
                    <div key={consumo.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-destructive">
                            - R$ {consumo.valor_abatido.toFixed(2).replace('.', ',')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Saldo: R$ {consumo.valor_anterior.toFixed(2)} → R$ {consumo.valor_apos.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(consumo.consumido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {consumo.observacao && (
                        <p className="text-xs text-muted-foreground mt-1">{consumo.observacao}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
