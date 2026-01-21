import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Gift, User } from 'lucide-react';

interface Premio {
  id: string;
  codigo: string;
  nome_ganhador: string;
  valor_restante: number;
  status: string;
}

interface AbaterValorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  premio: Premio;
  onSuccess: () => void;
}

export default function AbaterValorModal({
  open,
  onOpenChange,
  premio,
  onSuccess,
}: AbaterValorModalProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [frentistaNome, setFrentistaNome] = useState('');
  const [loading, setLoading] = useState(false);

  const valorNumerico = parseFloat(valor.replace(',', '.')) || 0;
  const isValid = valorNumerico > 0 && valorNumerico <= premio.valor_restante;

  // User logged in as admin/staff - use traditional method
  const handleSubmitAsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!isValid) {
      toast({
        title: 'Valor inválido',
        description: 'O valor deve ser maior que zero e menor ou igual ao saldo.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const valorAnterior = premio.valor_restante;
      const valorApos = valorAnterior - valorNumerico;

      // Insert consumption record
      const { error: consumoError } = await (supabase
        .from('premios_qr_consumos' as any) as any)
        .insert({
          premio_id: premio.id,
          valor_abatido: valorNumerico,
          valor_anterior: valorAnterior,
          valor_apos: valorApos,
          consumido_por: user.id,
          observacao: observacao || null,
        });

      if (consumoError) throw consumoError;

      // Update prize balance and status
      const newStatus = valorApos <= 0 ? 'zerado' : 'ativo';
      const { error: updateError } = await (supabase
        .from('premios_qr' as any) as any)
        .update({
          valor_restante: valorApos,
          status: newStatus,
        })
        .eq('id', premio.id);

      if (updateError) throw updateError;

      toast({
        title: 'Valor abatido!',
        description: `R$ ${valorNumerico.toFixed(2).replace('.', ',')} foi descontado do prêmio.`,
      });

      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error processing abatimento:', error);
      toast({
        title: 'Erro ao processar',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Not logged in - use frentista name method
  const handleSubmitWithFrentista = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!frentistaNome.trim()) {
      toast({
        title: 'Nome necessário',
        description: 'Digite o nome do frentista.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValid) {
      toast({
        title: 'Valor inválido',
        description: 'O valor deve ser maior que zero e menor ou igual ao saldo.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('abater_com_frentista', {
        p_frentista_nome: frentistaNome.trim(),
        p_premio_id: premio.id,
        p_valor: valorNumerico,
        p_observacao: observacao || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; frentista?: string; novo_saldo?: number };

      if (!result.success) {
        toast({
          title: 'Erro',
          description: result.error || 'Não foi possível processar o abatimento.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Valor abatido!',
        description: `R$ ${valorNumerico.toFixed(2).replace('.', ',')} descontado por ${result.frentista}. Novo saldo: R$ ${result.novo_saldo?.toFixed(2).replace('.', ',')}`,
      });

      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error processing abatimento:', error);
      toast({
        title: 'Erro ao processar',
        description: 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setValor('');
    setObservacao('');
    setFrentistaNome('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  // If user is logged in as admin/staff
  if (user) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Abater Valor
            </DialogTitle>
            <DialogDescription>
              Ganhador: <strong>{premio.nome_ganhador}</strong>
              <br />
              Saldo disponível:{' '}
              <strong className="text-green-600">
                R$ {premio.valor_restante.toFixed(2).replace('.', ',')}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAsAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor a abater (R$)</Label>
              <Input
                id="valor"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
              />
              {valorNumerico > premio.valor_restante && (
                <p className="text-sm text-destructive">
                  Valor maior que o saldo disponível
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea
                id="observacao"
                placeholder="Ex: Troca de óleo"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              Operador: {profile?.full_name || user?.email}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!isValid || loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar Abatimento'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // User not logged in - show frentista name form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Abater Valor
          </DialogTitle>
          <DialogDescription>
            Ganhador: <strong>{premio.nome_ganhador}</strong>
            <br />
            Saldo disponível:{' '}
            <strong className="text-green-600">
              R$ {premio.valor_restante.toFixed(2).replace('.', ',')}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitWithFrentista} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frentista-nome">Nome do Frentista</Label>
            <Input
              id="frentista-nome"
              type="text"
              placeholder="Digite seu nome"
              value={frentistaNome}
              onChange={(e) => setFrentistaNome(e.target.value)}
              autoFocus
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor-frentista">Valor a abater (R$)</Label>
            <Input
              id="valor-frentista"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            {valorNumerico > premio.valor_restante && (
              <p className="text-sm text-destructive">
                Valor maior que o saldo disponível
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao-frentista">Observação (opcional)</Label>
            <Textarea
              id="observacao-frentista"
              placeholder="Ex: Troca de óleo"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || !frentistaNome.trim() || loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Abatimento'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
