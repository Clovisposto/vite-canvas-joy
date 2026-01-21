import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { Gift, Loader2, Download, Copy, Printer, CheckCircle } from 'lucide-react';
import { getPremioPublicUrl } from '@/lib/public-url';

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const premioSchema = z.object({
  nome_ganhador: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().optional().refine((val) => !val || val.replace(/\D/g, '').length === 11, {
    message: 'CPF deve ter 11 dígitos',
  }),
  telefone: z.string().optional(),
  valor: z.number().min(1, 'Valor deve ser maior que zero'),
  validade_dias: z.number().min(1, 'Validade deve ser pelo menos 1 dia'),
  observacoes: z.string().optional(),
});

type PremioFormData = z.infer<typeof premioSchema>;

interface PremioFormProps {
  onSuccess?: () => void;
}

interface CreatedPremio {
  id: string;
  codigo: string;
  nome_ganhador: string;
  cpf: string | null;
  valor_original: number;
  data_expiracao: string;
}

export default function PremioForm({ onSuccess }: PremioFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [createdPremio, setCreatedPremio] = useState<CreatedPremio | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PremioFormData>({
    resolver: zodResolver(premioSchema),
    defaultValues: {
      valor: 100,
      validade_dias: 5,
    },
  });

  const onSubmit = async (data: PremioFormData) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para criar prêmios.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const codigo = crypto.randomUUID();
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + data.validade_dias);

      const { data: premio, error } = await (supabase
        .from('premios_qr' as any)
        .insert({
          codigo,
          nome_ganhador: data.nome_ganhador,
          cpf: data.cpf || null,
          telefone: data.telefone || null,
          valor_original: data.valor,
          valor_restante: data.valor,
          data_expiracao: dataExpiracao.toISOString(),
          created_by: user.id,
          observacoes: data.observacoes || null,
        })
        .select()
        .single() as any);

      if (error) throw error;

      setCreatedPremio(premio as CreatedPremio);
      toast({
        title: 'Prêmio criado!',
        description: `QR Code gerado para ${data.nome_ganhador}`,
      });

      reset();
    } catch (error) {
      console.error('Error creating premio:', error);
      toast({
        title: 'Erro ao criar prêmio',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPremioUrl = (codigo: string) => {
    return getPremioPublicUrl(codigo);
  };

  const handleCopyLink = async () => {
    if (!createdPremio) return;
    try {
      await navigator.clipboard.writeText(getPremioUrl(createdPremio.codigo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('premio-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `premio-${createdPremio?.codigo.slice(0, 8)}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow || !createdPremio) return;

    const svg = document.getElementById('premio-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Premiação - ${createdPremio.nome_ganhador}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .container {
              text-align: center;
              border: 2px solid #1e0f83;
              border-radius: 16px;
              padding: 24px;
              max-width: 300px;
            }
            h1 { color: #1e0f83; font-size: 18px; margin: 0 0 8px 0; }
            .nome { font-size: 16px; font-weight: bold; margin: 16px 0 4px 0; }
            .valor { font-size: 28px; font-weight: bold; color: #16a34a; margin: 8px 0; }
            .validade { font-size: 12px; color: #666; }
            .qr { margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎁 QR Premiação</h1>
            <div class="qr">${svgData}</div>
            <div class="nome">${createdPremio.nome_ganhador}</div>
            <div class="valor">R$ ${createdPremio.valor_original.toFixed(2).replace('.', ',')}</div>
            <div class="validade">Válido até: ${new Date(createdPremio.data_expiracao).toLocaleDateString('pt-BR')}</div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  const handleCreateNew = () => {
    setCreatedPremio(null);
    onSuccess?.();
  };

  if (createdPremio) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-green-700">Prêmio Criado com Sucesso!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-white p-4 rounded-lg inline-block">
              <QRCodeSVG
                id="premio-qr-code"
                value={getPremioUrl(createdPremio.codigo)}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="space-y-1">
              <p className="font-medium">{createdPremio.nome_ganhador}</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {createdPremio.valor_original.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-sm text-muted-foreground">
                Válido até: {new Date(createdPremio.data_expiracao).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                {copied ? <CheckCircle className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                <Download className="w-4 h-4 mr-1" />
                Baixar PNG
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" />
                Imprimir
              </Button>
            </div>

            <Button onClick={handleCreateNew} className="w-full">
              <Gift className="w-4 h-4 mr-2" />
              Criar Novo Prêmio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome_ganhador">Nome do Ganhador *</Label>
        <Input
          id="nome_ganhador"
          placeholder="Digite o nome completo"
          {...register('nome_ganhador')}
        />
        {errors.nome_ganhador && (
          <p className="text-sm text-destructive">{errors.nome_ganhador.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF (opcional)</Label>
          <Input
            id="cpf"
            placeholder="000.000.000-00"
            {...register('cpf', {
              onChange: (e) => {
                e.target.value = formatCPF(e.target.value);
              }
            })}
          />
          {errors.cpf && (
            <p className="text-sm text-destructive">{errors.cpf.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone (opcional)</Label>
          <Input
            id="telefone"
            placeholder="(00) 00000-0000"
            {...register('telefone')}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="valor">Valor do Prêmio (R$) *</Label>
          <Input
            id="valor"
            type="number"
            step="0.01"
            min="1"
            {...register('valor', { valueAsNumber: true })}
          />
          {errors.valor && (
            <p className="text-sm text-destructive">{errors.valor.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="validade_dias">Validade (dias) *</Label>
          <Input
            id="validade_dias"
            type="number"
            min="1"
            {...register('validade_dias', { valueAsNumber: true })}
          />
          {errors.validade_dias && (
            <p className="text-sm text-destructive">{errors.validade_dias.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações (opcional)</Label>
        <Textarea
          id="observacoes"
          placeholder="Notas adicionais sobre o prêmio..."
          {...register('observacoes')}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Gift className="w-4 h-4 mr-2" />
            Gerar QR Premiação
          </>
        )}
      </Button>
    </form>
  );
}
