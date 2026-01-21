import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Clock, Shield, Zap, Gauge } from 'lucide-react';
import type { BulkJobSettings } from '@/types/bulk-jobs';
import { BULK_MODE_PRESETS, estimateTotalTime, formatEstimatedTime } from '@/types/bulk-jobs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: { phone: string; name?: string }[];
  onSubmit: (data: { title: string; message: string; mode: BulkJobSettings['mode'] }) => Promise<boolean>;
}

const MODE_INFO: Record<BulkJobSettings['mode'], { icon: typeof Shield; label: string; desc: string; risk: string }> = {
  seguro: { 
    icon: Shield, 
    label: 'Seguro', 
    desc: '40-90s entre mensagens, máx 30/hora',
    risk: 'Baixo risco de bloqueio'
  },
  moderado: { 
    icon: Gauge, 
    label: 'Moderado', 
    desc: '20-50s entre mensagens, máx 50/hora',
    risk: 'Risco médio'
  },
  rapido: { 
    icon: Zap, 
    label: 'Rápido', 
    desc: '10-30s entre mensagens, máx 80/hora',
    risk: 'Risco alto'
  },
};

export default function BulkJobCreateDialog({ open, onOpenChange, contacts, onSubmit }: Props) {
  const [title, setTitle] = useState(`Envio ${new Date().toLocaleDateString('pt-BR')}`);
  const [message, setMessage] = useState('Olá{nome ? `, ${nome}` : ""}! Aqui é do Posto. Temos uma novidade especial para você!');
  const [mode, setMode] = useState<BulkJobSettings['mode']>('seguro');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedMinutes = estimateTotalTime(contacts.length, { mode, ...BULK_MODE_PRESETS[mode] });
  const estimatedTime = formatEstimatedTime(estimatedMinutes);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) return;
    
    setIsSubmitting(true);
    const success = await onSubmit({ title: title.trim(), message: message.trim(), mode });
    setIsSubmitting(false);
    
    if (success) {
      onOpenChange(false);
      // Reset form
      setTitle(`Envio ${new Date().toLocaleDateString('pt-BR')}`);
      setMode('seguro');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Campanha de Envio em Massa</DialogTitle>
          <DialogDescription>
            Configure a campanha para {contacts.length} contatos selecionados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título da campanha</Label>
            <Input 
              id="title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Promoção de Natal"
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea 
              id="message" 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Digite a mensagem..."
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para personalizar com o nome do cliente
            </p>
          </div>

          {/* Modo de envio */}
          <div className="space-y-3">
            <Label>Modo de envio</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as BulkJobSettings['mode'])}>
              {(Object.keys(MODE_INFO) as BulkJobSettings['mode'][]).map((m) => {
                const info = MODE_INFO[m];
                const Icon = info.icon;
                return (
                  <div 
                    key={m} 
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      mode === m ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setMode(m)}
                  >
                    <RadioGroupItem value={m} id={m} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${m === 'seguro' ? 'text-green-600' : m === 'moderado' ? 'text-yellow-600' : 'text-red-600'}`} />
                        <Label htmlFor={m} className="font-medium cursor-pointer">{info.label}</Label>
                        <Badge variant={m === 'seguro' ? 'default' : m === 'moderado' ? 'secondary' : 'destructive'} className="text-xs">
                          {info.risk}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{info.desc}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Estimativa */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Tempo estimado: <strong>{estimatedTime}</strong> para {contacts.length} contatos
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !title.trim() || !message.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Criar Campanha</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
