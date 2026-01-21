import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Loader2, Save, Eye, EyeOff } from 'lucide-react';

interface Variable {
  key: string;
  desc: string;
  example?: string;
}

interface MessageEditorButtonProps {
  settingKey: string;
  title: string;
  description?: string;
  variables?: Variable[];
  defaultMessage?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export default function MessageEditorButton({
  settingKey,
  title,
  description,
  variables = [],
  defaultMessage = '',
  buttonVariant = 'outline',
  buttonSize = 'default',
  className
}: MessageEditorButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Carregar mensagem do banco
  const loadMessage = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', settingKey)
        .single();

      if (data?.value) {
        // O valor pode vir como string com aspas ou objeto
        const rawValue = data.value;
        const value = typeof rawValue === 'string' 
          ? rawValue.replace(/^"|"$/g, '') 
          : String(rawValue);
        setMessage(value);
      } else {
        setMessage(defaultMessage);
      }
    } catch (error) {
      console.log('Configuração não encontrada, usando padrão');
      setMessage(defaultMessage);
    } finally {
      setLoading(false);
    }
  };

  // Salvar mensagem no banco
  const handleSave = async () => {
    setSaving(true);
    try {
      // Tentar atualizar primeiro
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', settingKey)
        .single();

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from('settings')
          .update({ value: message, updated_at: new Date().toISOString() })
          .eq('key', settingKey);
        
        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase
          .from('settings')
          .insert({ key: settingKey, value: message, description: title });
        
        if (error) throw error;
      }

      toast({ title: 'Mensagem salva com sucesso!' });
      setOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Gerar preview com variáveis substituídas
  const getPreviewMessage = () => {
    let preview = message;
    variables.forEach(v => {
      const example = v.example || `[${v.desc}]`;
      preview = preview.replace(new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g'), example);
    });
    return preview;
  };

  // Destacar variáveis na mensagem
  const renderMessageWithHighlights = () => {
    let parts: { text: string; isVariable: boolean }[] = [];
    let currentMessage = message;
    let lastIndex = 0;

    // Regex para encontrar variáveis {{...}}
    const regex = /\{\{[^}]+\}\}/g;
    let match;

    while ((match = regex.exec(message)) !== null) {
      // Texto antes da variável
      if (match.index > lastIndex) {
        parts.push({ text: message.slice(lastIndex, match.index), isVariable: false });
      }
      // A variável
      parts.push({ text: match[0], isVariable: true });
      lastIndex = match.index + match[0].length;
    }

    // Texto restante
    if (lastIndex < message.length) {
      parts.push({ text: message.slice(lastIndex), isVariable: false });
    }

    return parts;
  };

  useEffect(() => {
    if (open) {
      loadMessage();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={className}>
          <MessageSquare className="w-4 h-4 mr-2" />
          Editar Mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Variáveis disponíveis */}
            {variables.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Variáveis disponíveis:</Label>
                <div className="flex flex-wrap gap-2">
                  {variables.map(v => (
                    <Badge 
                      key={v.key} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => {
                        setMessage(prev => prev + v.key);
                      }}
                    >
                      <span className="font-mono text-xs">{v.key}</span>
                      <span className="ml-1 text-muted-foreground">- {v.desc}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Campo de mensagem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Mensagem</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-1" />
                      Editar
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </>
                  )}
                </Button>
              </div>

              {showPreview ? (
                <div className="p-4 rounded-lg bg-muted/50 border whitespace-pre-wrap min-h-[200px] text-sm">
                  {getPreviewMessage()}
                </div>
              ) : (
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem..."
                  className="min-h-[200px] font-mono text-sm"
                />
              )}
            </div>

            {/* Dicas */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>💡 Use *texto* para <strong>negrito</strong></p>
              <p>💡 Use _texto_ para <em>itálico</em></p>
              <p>💡 Use emojis para deixar a mensagem mais amigável</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
