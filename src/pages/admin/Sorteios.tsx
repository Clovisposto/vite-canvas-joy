import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Play, Trophy, Plus, Edit2, Trash2, Users, Calendar, DollarSign, Loader2, History, Gift, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MessageEditorButton from '@/components/admin/MessageEditorButton';

interface Raffle {
  id: string;
  name: string;
  winners_count: number;
  prize_value: number | null;
  rules: string | null;
  is_active: boolean;
  created_at: string;
}

interface RaffleRun {
  id: string;
  raffle_id: string;
  executed_at: string;
  eligible_count: number | null;
  winners: any;
  is_test: boolean | null;
  seed: string | null;
}

export default function AdminSorteios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [runs, setRuns] = useState<RaffleRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningRaffle, setRunningRaffle] = useState<string | null>(null);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingRaffle, setEditingRaffle] = useState<Raffle | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    winners_count: 1,
    prize_value: '',
    rules: '',
    is_active: true
  });

  useEffect(() => {
    fetchRaffles();
    fetchRuns();
  }, []);

  const fetchRaffles = async () => {
    const { data } = await supabase
      .from('raffles')
      .select('*')
      .order('created_at', { ascending: false });
    setRaffles(data || []);
  };

  const fetchRuns = async () => {
    const { data } = await supabase
      .from('raffle_runs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(20);
    setRuns(data || []);
  };

  const openCreateDialog = () => {
    setEditingRaffle(null);
    setForm({
      name: '',
      winners_count: 1,
      prize_value: '',
      rules: '',
      is_active: true
    });
    setShowDialog(true);
  };

  const openEditDialog = (raffle: Raffle) => {
    setEditingRaffle(raffle);
    setForm({
      name: raffle.name,
      winners_count: raffle.winners_count,
      prize_value: raffle.prize_value?.toString() || '',
      rules: raffle.rules || '',
      is_active: raffle.is_active
    });
    setShowDialog(true);
  };

  const saveRaffle = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Digite o nome do sorteio', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const raffleData = {
        name: form.name.trim(),
        winners_count: form.winners_count || 1,
        prize_value: form.prize_value ? parseFloat(form.prize_value) : null,
        rules: form.rules.trim() || null,
        is_active: form.is_active
      };

      if (editingRaffle) {
        await supabase
          .from('raffles')
          .update(raffleData)
          .eq('id', editingRaffle.id);
        toast({ title: 'Sorteio atualizado!' });
      } else {
        await supabase
          .from('raffles')
          .insert(raffleData);
        toast({ title: 'Sorteio criado!' });
      }

      setShowDialog(false);
      fetchRaffles();
    } catch (err) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRaffle = async (raffle: Raffle) => {
    if (!confirm(`Excluir sorteio "${raffle.name}"?`)) return;
    
    await supabase.from('raffles').delete().eq('id', raffle.id);
    toast({ title: 'Sorteio excluído!' });
    fetchRaffles();
  };

  const toggleActive = async (raffle: Raffle) => {
    await supabase
      .from('raffles')
      .update({ is_active: !raffle.is_active })
      .eq('id', raffle.id);
    fetchRaffles();
  };

  // Load winner message from settings
  const loadWinnerMessage = async (): Promise<string> => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'whatsapp_raffle_winner_message')
      .single();
    
    if (data?.value) {
      // Handle both string and JSON stored values
      const rawValue = data.value;
      if (typeof rawValue === 'string') {
        return rawValue.replace(/^"|"$/g, '');
      }
      return String(rawValue);
    }
    return '';
  };

  // Send message to winner via wa-send edge function
  const sendWinnerMessage = async (
    phone: string, 
    name: string, 
    raffleName: string, 
    prizeValue: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let message = await loadWinnerMessage();
      
      if (!message) {
        return { success: false, error: 'Mensagem do ganhador não configurada' };
      }
      
      // Replace variables - support both {{1}} and {{nome}} formats
      const formattedPrize = prizeValue 
        ? `R$ ${prizeValue.toFixed(2).replace('.', ',')}` 
        : 'R$ 100,00';
      
      message = message
        .replace(/\{\{1\}\}/g, name || 'Cliente')
        .replace(/\{\{nome\}\}/g, name || 'Cliente')
        .replace(/\{\{sorteio\}\}/g, raffleName)
        .replace(/\{\{premio\}\}/g, formattedPrize);
      
      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('wa-send', {
        body: { phone: normalizedPhone, message }
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: data?.success === true, error: data?.error };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro desconhecido' };
    }
  };

  const runRaffle = async (raffle: Raffle) => {
    setRunningRaffle(raffle.id);
    setLoading(true);
    
    try {
      const { data: eligible } = await supabase
        .from('wa_contacts')
        .select('id, phone, name')
        .eq('opt_in', true);
      
      if (!eligible || eligible.length === 0) {
        toast({ title: 'Nenhum cliente elegível', description: 'Não há clientes que aceitaram participar do sorteio.', variant: 'destructive' });
        return;
      }

      const seed = Date.now().toString();
      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, raffle.winners_count).map((w: any) => ({ 
        id: w.id, 
        phone: w.phone, 
        name: w.name 
      }));

      await supabase.from('raffle_runs').insert({ 
        raffle_id: raffle.id, 
        eligible_count: eligible.length, 
        seed, 
        winners, 
        executed_by: user?.id,
        is_test: false
      });

      toast({ 
        title: '🎉 Sorteio realizado!', 
        description: `${winners.length} ganhador(es) selecionado(s). Enviando mensagens...` 
      });

      // Automatic message sending to each winner
      let enviados = 0;
      let erros = 0;

      for (const winner of winners) {
        try {
          const result = await sendWinnerMessage(
            winner.phone, 
            winner.name, 
            raffle.name, 
            raffle.prize_value || 100
          );
          
          if (result.success) {
            enviados++;
          } else {
            erros++;
            console.error(`Erro ao enviar para ${winner.phone}:`, result.error);
          }
          
          // Delay of 2 seconds between messages to avoid blocking
          if (winners.indexOf(winner) < winners.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (e) {
          erros++;
          console.error(`Exceção ao enviar para ${winner.phone}:`, e);
        }
      }

      // Final feedback
      if (erros === 0 && enviados > 0) {
        toast({ 
          title: '✅ Mensagens enviadas!', 
          description: `${enviados} ganhador(es) notificado(s) com sucesso via WhatsApp.` 
        });
      } else if (enviados > 0) {
        toast({ 
          title: '⚠️ Envio parcial', 
          description: `${enviados} enviado(s), ${erros} falha(s). Verifique o Robô WhatsApp.`,
          variant: 'destructive'
        });
      } else if (erros > 0) {
        toast({ 
          title: '❌ Falha no envio', 
          description: `Não foi possível enviar mensagens. Verifique a conexão do WhatsApp.`,
          variant: 'destructive'
        });
      }
      
      fetchRuns();
    } catch (err) {
      toast({ title: 'Erro ao executar sorteio', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRunningRaffle(null);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 12) {
      // Formato: (94) 99132-4567
      return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    } else if (digits.length >= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  return (
    <AdminLayout title="Sorteios">
      <div className="space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gerenciar Sorteios</h2>
            <p className="text-sm text-muted-foreground">Crie e execute sorteios para seus clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <MessageEditorButton
              settingKey="whatsapp_raffle_winner_message"
              title="Mensagem do Ganhador"
              description="Mensagem enviada automaticamente quando o cliente ganha o sorteio"
              variables={[
                { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' },
                { key: '{{sorteio}}', desc: 'Nome do sorteio', example: 'Sorteio Semanal' },
                { key: '{{premio}}', desc: 'Valor do prêmio', example: 'R$ 100,00' }
              ]}
              defaultMessage={`🎉 *PARABÉNS {{nome}}!* 🎉

Você foi sorteado(a) no *{{sorteio}}*!

🏆 Seu prêmio: *{{premio}}*

Entre em contato conosco para retirar seu prêmio. Estamos muito felizes por você! 🥳

Auto Posto Pará – Economia de verdade!`}
              buttonVariant="outline"
            />
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Sorteio
            </Button>
          </div>
        </div>

        {/* Raffles List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Sorteios Configurados
            </CardTitle>
            <CardDescription>
              {raffles.length === 0 
                ? 'Nenhum sorteio cadastrado. Clique em "Novo Sorteio" para criar.'
                : `${raffles.length} sorteio(s) cadastrado(s)`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {raffles.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum sorteio cadastrado</p>
                <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Sorteio
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {raffles.map(raffle => (
                  <div 
                    key={raffle.id} 
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      raffle.is_active ? 'bg-muted/30 border-primary/20' : 'bg-muted/10 border-border/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-yellow-500/10">
                        <Trophy className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{raffle.name}</p>
                          <Badge variant={raffle.is_active ? 'default' : 'secondary'}>
                            {raffle.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {raffle.winners_count} ganhador(es)
                          </span>
                          {raffle.prize_value && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              R$ {raffle.prize_value.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => toggleActive(raffle)}
                        title={raffle.is_active ? 'Desativar' : 'Ativar'}
                      >
                        <Switch checked={raffle.is_active} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(raffle)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteRaffle(raffle)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        onClick={() => runRaffle(raffle)} 
                        disabled={loading || !raffle.is_active}
                        className="ml-2"
                      >
                        {runningRaffle === raffle.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        Rodar Agora
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Runs History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Execuções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum sorteio executado ainda
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Elegíveis</TableHead>
                    <TableHead>Ganhadores</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(run => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(run.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{run.eligible_count} participantes</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(run.winners as any[])?.map((w: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {w.name || formatPhone(w.phone)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={run.is_test ? 'outline' : 'default'}>
                          {run.is_test ? 'Teste' : 'Oficial'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRaffle ? 'Editar Sorteio' : 'Novo Sorteio'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Sorteio *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Sorteio Semanal"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="winners">Qtd. Ganhadores</Label>
                  <Input
                    id="winners"
                    type="number"
                    min={1}
                    max={100}
                    value={form.winners_count}
                    onChange={(e) => setForm(f => ({ ...f, winners_count: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prize">Valor do Prêmio (R$)</Label>
                  <Input
                    id="prize"
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.prize_value}
                    onChange={(e) => setForm(f => ({ ...f, prize_value: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rules">Regras (opcional)</Label>
                <Textarea
                  id="rules"
                  value={form.rules}
                  onChange={(e) => setForm(f => ({ ...f, rules: e.target.value }))}
                  placeholder="Descreva as regras do sorteio..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label>Sorteio Ativo</Label>
                  <p className="text-xs text-muted-foreground">Sorteios inativos não podem ser executados</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={saveRaffle} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {editingRaffle ? 'Salvar Alterações' : 'Criar Sorteio'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
