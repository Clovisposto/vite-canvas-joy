import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, KeyRound, RefreshCw, Eye, EyeOff, Trash2, Shield } from 'lucide-react';

interface Frentista {
  id: string;
  codigo: string;
  nome: string;
  is_active: boolean;
}

interface FrentistaPin {
  id: string;
  frentista_id: string;
  is_active: boolean;
  created_at: string;
}

interface FrentistaPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frentista: Frentista | null;
  onSuccess: () => void;
}

export default function FrentistaPinDialog({
  open,
  onOpenChange,
  frentista,
  onSuccess,
}: FrentistaPinDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existingPin, setExistingPin] = useState<FrentistaPin | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  useEffect(() => {
    if (open && frentista) {
      fetchExistingPin();
      setNewPin('');
      setConfirmPin('');
      setGeneratedPin(null);
    }
  }, [open, frentista]);

  const fetchExistingPin = async () => {
    if (!frentista) return;

    const { data } = await supabase
      .from('frentistas_pins')
      .select('*')
      .eq('frentista_id', frentista.id)
      .maybeSingle();

    setExistingPin(data);
  };

  const generateRandomPin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setNewPin(pin);
    setConfirmPin(pin);
    setGeneratedPin(pin);
  };

  const handleSavePin = async () => {
    if (!frentista) return;

    if (newPin.length < 4) {
      toast({
        title: 'PIN muito curto',
        description: 'O PIN deve ter pelo menos 4 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: 'PINs não conferem',
        description: 'Digite o mesmo PIN nos dois campos.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (existingPin) {
        // Update existing PIN
        const { error } = await supabase
          .from('frentistas_pins')
          .update({ pin_hash: newPin, is_active: true })
          .eq('id', existingPin.id);

        if (error) throw error;

        toast({
          title: 'PIN atualizado!',
          description: `PIN de ${frentista.nome} foi alterado com sucesso.`,
        });
      } else {
        // Create new PIN
        const { error } = await supabase
          .from('frentistas_pins')
          .insert({
            frentista_id: frentista.id,
            pin_hash: newPin,
            is_active: true,
          });

        if (error) throw error;

        toast({
          title: 'PIN criado!',
          description: `PIN configurado para ${frentista.nome}.`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving PIN:', error);
      toast({
        title: 'Erro ao salvar PIN',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePinStatus = async () => {
    if (!existingPin) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('frentistas_pins')
        .update({ is_active: !existingPin.is_active })
        .eq('id', existingPin.id);

      if (error) throw error;

      toast({
        title: existingPin.is_active ? 'PIN desativado' : 'PIN ativado',
        description: `PIN de ${frentista?.nome} foi ${existingPin.is_active ? 'desativado' : 'ativado'}.`,
      });

      onSuccess();
      fetchExistingPin();
    } catch (error) {
      console.error('Error toggling PIN:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do PIN.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePin = async () => {
    if (!existingPin) return;

    if (!confirm(`Tem certeza que deseja excluir o PIN de ${frentista?.nome}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('frentistas_pins')
        .delete()
        .eq('id', existingPin.id);

      if (error) throw error;

      toast({
        title: 'PIN excluído',
        description: `PIN de ${frentista?.nome} foi removido.`,
      });

      onSuccess();
      fetchExistingPin();
    } catch (error) {
      console.error('Error deleting PIN:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o PIN.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!frentista) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            PIN do Frentista
          </DialogTitle>
          <DialogDescription>
            Gerencie o PIN de <strong>{frentista.nome}</strong> ({frentista.codigo})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {existingPin ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm">PIN configurado</span>
                </div>
                <Badge variant={existingPin.is_active ? 'default' : 'secondary'}>
                  {existingPin.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={existingPin.is_active ? 'destructive' : 'default'}
                  size="sm"
                  className="flex-1"
                  onClick={handleTogglePinStatus}
                  disabled={loading}
                >
                  {existingPin.is_active ? 'Desativar PIN' : 'Ativar PIN'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeletePin}
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Alterar PIN:
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Este frentista ainda não tem PIN configurado.</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="new-pin">Novo PIN (4-6 dígitos)</Label>
                <div className="relative">
                  <Input
                    id="new-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="pt-6">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={generateRandomPin}
                  title="Gerar PIN aleatório"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {generatedPin && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">
                  <strong>PIN gerado:</strong> {generatedPin}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  Anote e informe ao frentista. O PIN não será exibido novamente.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="confirm-pin">Confirmar PIN</Label>
              <Input
                id="confirm-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              />
              {confirmPin && newPin !== confirmPin && (
                <p className="text-xs text-destructive">Os PINs não conferem</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSavePin}
            disabled={loading || newPin.length < 4 || newPin !== confirmPin}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar PIN'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
