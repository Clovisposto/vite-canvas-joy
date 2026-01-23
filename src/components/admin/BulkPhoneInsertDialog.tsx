import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BulkPhoneInsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ImportResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

// Normaliza telefone para formato E.164 brasileiro
const normalizePhone = (phone: string): string | null => {
  if (!phone) return null;
  
  let value = phone.trim();
  
  // Detectar notação científica (5,59E+12 ou 5.59E+12)
  const scientificPattern = /^(\d+[,.]?\d*)E\+?(\d+)$/i;
  const match = value.replace(',', '.').match(scientificPattern);
  if (match) {
    const base = parseFloat(match[1]);
    const exponent = parseInt(match[2], 10);
    value = (base * Math.pow(10, exponent)).toFixed(0);
  }
  
  // Remove tudo que não for dígito
  let digits = value.replace(/\D/g, '');
  
  // Mínimo 10 dígitos (DDD + 8), máximo 13 (55 + DDD + 9)
  if (digits.length < 10 || digits.length > 13) return null;
  
  // Se começa com 0, remove (ex: 094991234567 -> 94991234567)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  // Se não começa com 55, adiciona código do país
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Valida tamanho final: 12 (55+DDD+8) ou 13 (55+DDD+9) dígitos
  if (digits.length < 12 || digits.length > 13) return null;
  
  return digits;
};

export default function BulkPhoneInsertDialog({ open, onOpenChange, onImportComplete }: BulkPhoneInsertDialogProps) {
  const { toast } = useToast();
  const [rawText, setRawText] = useState('');
  const [name, setName] = useState('');
  const [optInMarketing, setOptInMarketing] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  const resetState = useCallback(() => {
    setRawText('');
    setName('');
    setOptInMarketing(true);
    setResult(null);
    setProgress(0);
    setImporting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  // Parse e normaliza os telefones do texto
  const parsePhones = useCallback((text: string): string[] => {
    // Separa por linha, vírgula, ponto-e-vírgula ou espaço
    const raw = text.split(/[\n,;\s]+/).map(p => p.trim()).filter(Boolean);
    const normalized: string[] = [];
    const seen = new Set<string>();
    
    for (const phone of raw) {
      const norm = normalizePhone(phone);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        normalized.push(norm);
      }
    }
    
    return normalized;
  }, []);

  const validPhones = parsePhones(rawText);

  const handleImport = async () => {
    if (validPhones.length === 0) {
      toast({
        title: 'Nenhum telefone válido',
        description: 'Verifique os números e tente novamente',
        variant: 'destructive'
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    const batchSize = 50;
    const results: ImportResult = {
      total: validPhones.length,
      inserted: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Buscar telefones existentes
      const existingPhones = new Set<string>();
      const checkBatchSize = 100;

      for (let i = 0; i < validPhones.length; i += checkBatchSize) {
        const batch = validPhones.slice(i, i + checkBatchSize);
        const { data } = await supabase
          .from('customers')
          .select('phone')
          .in('phone', batch);
        
        (data || []).forEach(c => existingPhones.add(c.phone));
        setProgress(Math.round((i / validPhones.length) * 20));
      }

      // Filtrar novos
      const newPhones = validPhones.filter(p => !existingPhones.has(p));
      results.skipped = existingPhones.size;

      // Inserir novos em lotes
      for (let i = 0; i < newPhones.length; i += batchSize) {
        const batch = newPhones.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('customers')
          .insert(
            batch.map(phone => ({
              phone,
              name: name.trim() || null,
              lgpd_consent: optInMarketing,
              accepts_raffle: optInMarketing,
              accepts_promo: optInMarketing,
            }))
          );
        
        if (error) {
          results.errors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          results.inserted += batch.length;
        }
        
        setProgress(20 + Math.round(((i + batch.length) / validPhones.length) * 80));
      }

      setResult(results);
      setProgress(100);

      toast({
        title: 'Inserção concluída!',
        description: `${results.inserted} inseridos, ${results.skipped} já existentes`
      });

      onImportComplete?.();
    } catch (err: any) {
      toast({
        title: 'Erro na inserção',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Inserir Telefones Manualmente
          </DialogTitle>
          <DialogDescription>
            Cole ou digite vários telefones de uma vez para adicionar à base de clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!result && (
            <>
              {/* Textarea para telefones */}
              <div className="space-y-2">
                <Label htmlFor="phones">
                  Telefones (um por linha ou separados por vírgula/ponto-e-vírgula)
                </Label>
                <Textarea
                  id="phones"
                  placeholder={`5594991234567\n5594997654321\n11987654321\n...`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Aceita formatos: com ou sem código do país (55), com DDDs variados
                </p>
              </div>

              {/* Campo de nome opcional */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome (opcional - aplicado a todos)</Label>
                <Input
                  id="name"
                  placeholder="Ex: Campanha Janeiro"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Checkbox opt-in marketing */}
              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="opt-in-marketing"
                  checked={optInMarketing}
                  onCheckedChange={(checked) => setOptInMarketing(!!checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="opt-in-marketing" className="cursor-pointer font-medium">
                    Marcar opt-in de marketing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita LGPD e aceite de promoções para aparecer em campanhas WhatsApp
                  </p>
                </div>
              </div>

              {/* Preview */}
              {rawText.trim() && (
                <div className="flex items-center gap-2">
                  {validPhones.length > 0 ? (
                    <Badge variant="default">{validPhones.length} telefones válidos</Badge>
                  ) : (
                    <Badge variant="destructive">Nenhum telefone válido detectado</Badge>
                  )}
                </div>
              )}
            </>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Inserindo...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Result */}
          {result && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Inserção concluída!
                  </p>
                  <ul className="text-sm space-y-0.5">
                    <li>✓ {result.inserted} telefones inseridos</li>
                    <li>○ {result.skipped} já existentes (ignorados)</li>
                    {result.errors.length > 0 && (
                      <li className="text-destructive">✗ {result.errors.length} erros</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validPhones.length === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Inserindo...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Inserir {validPhones.length} telefones
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
