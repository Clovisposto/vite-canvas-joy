import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, AlertCircle, Cloud, Settings, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import CloudflareTunnelWizard from '@/components/admin/CloudflareTunnelWizard';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const PHONE_REGEX = /^\d{10,14}$/;
const MAX_AMOUNT = 50000; // R$ 50.000
const MAX_LITERS = 2000; // 2000 liters

interface ImportError {
  line: number;
  message: string;
}

export default function AdminIntegracoes() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showTunnelWizard, setShowTunnelWizard] = useState(false);
  const [tunnelStatus, setTunnelStatus] = useState<'unknown' | 'healthy' | 'unhealthy'>('unknown');

  const validateLine = (line: string, lineNumber: number): { valid: boolean; phone?: string; amount?: number; liters?: number; error?: string } => {
    const parts = line.split(';').map(s => s.trim());
    
    if (parts.length < 1) {
      return { valid: false, error: 'Linha vazia ou mal formatada' };
    }

    const [phone, amountStr, litersStr] = parts;

    // Validate phone
    const cleanPhone = phone.replace(/\D/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      return { valid: false, error: `Telefone inválido: ${phone}` };
    }

    // Validate amount if provided
    let amount: number | undefined;
    if (amountStr && amountStr.trim()) {
      const parsed = parseFloat(amountStr.replace(',', '.'));
      if (isNaN(parsed) || parsed < 0) {
        return { valid: false, error: `Valor inválido: ${amountStr}` };
      }
      if (parsed > MAX_AMOUNT) {
        return { valid: false, error: `Valor excede limite (R$ ${MAX_AMOUNT}): ${amountStr}` };
      }
      amount = parsed;
    }

    // Validate liters if provided
    let liters: number | undefined;
    if (litersStr && litersStr.trim()) {
      const parsed = parseFloat(litersStr.replace(',', '.'));
      if (isNaN(parsed) || parsed < 0) {
        return { valid: false, error: `Litros inválido: ${litersStr}` };
      }
      if (parsed > MAX_LITERS) {
        return { valid: false, error: `Litros excede limite (${MAX_LITERS}L): ${litersStr}` };
      }
      liters = parsed;
    }

    return { valid: true, phone: cleanPhone, amount, liters };
  };

  const handleImport = async () => {
    if (!file) return;

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      toast({ 
        title: 'Erro', 
        description: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const text = await file.text();
      const lines = text.split('\n').slice(1).filter(line => line.trim()); // Skip header, filter empty
      
      if (lines.length === 0) {
        toast({ title: 'Erro', description: 'Arquivo não contém dados válidos', variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (lines.length > 10000) {
        toast({ title: 'Erro', description: 'Máximo de 10.000 linhas por importação', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const importErrors: ImportError[] = [];
      let matched = 0;
      let skipped = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineNumber = i + 2; // +2 because of header and 0-index
        const validation = validateLine(lines[i], lineNumber);

        if (!validation.valid) {
          importErrors.push({ line: lineNumber, message: validation.error! });
          skipped++;
          continue;
        }

        const { phone, amount, liters } = validation;

        // Find contact by phone in wa_contacts
        const { data: contact } = await supabase
          .from('wa_contacts')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();

        if (contact) {
          const updateData: { amount?: number; liters?: number } = {};
          if (amount !== undefined) updateData.amount = amount;
          if (liters !== undefined) updateData.liters = liters;

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('checkins')
              .update(updateData)
              .eq('phone', phone);
            matched++;
          }
        } else {
          importErrors.push({ line: lineNumber, message: `Contato não encontrado: ${phone}` });
          skipped++;
        }
      }

      // Log import
      await supabase.from('imports_logs').insert([{ 
        filename: file.name, 
        records_total: lines.length, 
        records_matched: matched, 
        records_created: 0,
        records_failed: skipped,
        errors: importErrors.slice(0, 100) as unknown as import('@/integrations/supabase/types').Json
      }]);

      setErrors(importErrors.slice(0, 20)); // Show first 20 errors in UI

      if (matched > 0) {
        toast({ 
          title: 'Importação concluída', 
          description: `${matched} registros atualizados${skipped > 0 ? `, ${skipped} ignorados` : ''}` 
        });
      } else {
        toast({ 
          title: 'Nenhum registro atualizado', 
          description: `${skipped} linhas ignoradas. Verifique os erros abaixo.`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Erro na importação', description: 'Erro ao processar arquivo', variant: 'destructive' });
    }

    setLoading(false);
  };

  const handleTunnelComplete = (tunnelUrl: string) => {
    setShowTunnelWizard(false);
    setTunnelStatus('healthy');
    toast({
      title: 'Túnel configurado!',
      description: `URL permanente: ${tunnelUrl}. Agora atualize a secret EVOLUTION_API_URL nas configurações do projeto.`
    });
  };

  return (
    <AdminLayout title="Integrações">
      <Tabs defaultValue="tunnel" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tunnel" className="flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Túnel Cloudflare
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Importar CSV
          </TabsTrigger>
        </TabsList>

        {/* Cloudflare Tunnel Tab */}
        <TabsContent value="tunnel" className="space-y-4">
          {!showTunnelWizard ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5" />
                  Túnel Permanente Evolution API
                </CardTitle>
                <CardDescription>
                  Configure um túnel Cloudflare permanente para a Evolution API. 
                  Isso garante que a URL nunca expire, diferente dos túneis temporários.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      tunnelStatus === 'healthy' ? 'bg-green-500' :
                      tunnelStatus === 'unhealthy' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="font-medium">Status do Túnel</p>
                      <p className="text-sm text-muted-foreground">
                        {tunnelStatus === 'healthy' ? 'Túnel permanente configurado e funcionando' :
                         tunnelStatus === 'unhealthy' ? 'Túnel com problemas - verifique a configuração' :
                         'Status desconhecido - configure o túnel'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={tunnelStatus === 'healthy' ? 'default' : 'secondary'}>
                    {tunnelStatus === 'healthy' ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</>
                    ) : tunnelStatus === 'unhealthy' ? (
                      <><XCircle className="w-3 h-3 mr-1" /> Erro</>
                    ) : (
                      <><Settings className="w-3 h-3 mr-1" /> Pendente</>
                    )}
                  </Badge>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                    Por que usar túnel permanente?
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>URLs temporários expiram</strong> - túneis `trycloudflare.com` duram poucas horas</li>
                    <li>• <strong>URL fixo</strong> - seu domínio personalizado (ex: evolution.seudominio.com.br)</li>
                    <li>• <strong>Auto-reconexão</strong> - serviço reinicia automaticamente com o servidor</li>
                    <li>• <strong>Sem manutenção</strong> - uma vez configurado, funciona indefinidamente</li>
                  </ul>
                </div>

                <Button onClick={() => setShowTunnelWizard(true)} className="w-full">
                  <Cloud className="w-4 h-4 mr-2" />
                  Configurar Túnel Permanente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CloudflareTunnelWizard 
              onComplete={handleTunnelComplete}
              onClose={() => setShowTunnelWizard(false)}
            />
          )}
        </TabsContent>

        {/* CSV Import Tab */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Importar CSV de Vendas
              </CardTitle>
              <CardDescription>
                Importe dados de vendas (Cielo, Posto Gestor) para enriquecer check-ins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input 
                type="file" 
                accept=".csv" 
                onChange={e => {
                  setFile(e.target.files?.[0] || null);
                  setErrors([]);
                }} 
              />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Formato esperado: <code>telefone;valor;litros</code> (separado por ponto e vírgula)</p>
                <p>Limites: arquivo até 5MB, máximo 10.000 linhas, valor até R$ 50.000, litros até 2.000L</p>
              </div>
              <Button onClick={handleImport} disabled={!file || loading}>
                <Upload className="w-4 h-4 mr-2" />
                {loading ? 'Importando...' : 'Importar'}
              </Button>

              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Erros encontrados ({errors.length}):</p>
                    <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                      {errors.map((err, i) => (
                        <li key={i}>Linha {err.line}: {err.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}