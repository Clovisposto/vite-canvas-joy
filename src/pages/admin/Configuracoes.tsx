import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, MessageCircle, Send, Loader2, CheckCircle2, AlertCircle, Palette, Heart, Upload, Image, X, Wifi, WifiOff, Cloud, Star, ThumbsUp, ThumbsDown, Smile } from 'lucide-react';
import CloudflareTunnelWizard from '@/components/admin/CloudflareTunnelWizard';
import WhatsAppStatusDashboard from '@/components/admin/WhatsAppStatusDashboard';

interface WhatsAppSettings {
  id?: string;
  provider: 'EVOLUTION';
  enabled: boolean;
  evolution_base_url: string;
  evolution_api_key: string;
  evolution_instance: string;
}

interface WaTestResult {
  ok: boolean;
  step?: string;
  error?: string;
  details?: Record<string, unknown>;
  checklist?: Record<string, string>;
  help?: Record<string, string>;
  connected?: boolean;
  detail?: string;
  provider?: string;
}

export default function AdminConfiguracoes() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Demo send test
  const [demoPhone, setDemoPhone] = useState('');
  const [demoMessage, setDemoMessage] = useState('Teste de envio via Evolution API 🚀');
  const [demoSending, setDemoSending] = useState(false);
  const [demoResult, setDemoResult] = useState<Record<string, unknown> | null>(null);

  // Normalize URL: remove trailing slashes
  const normalizeUrl = (url: string): string => {
    return url.trim().replace(/\/+$/, '');
  };

  // Normalize Instance Name: remove common prefixes and clean up
  const normalizeInstanceName = (name: string): string => {
    return name
      .trim()
      // Remove common wrong prefixes
      .replace(/^EVOLUTION_INSTANCE_NAME\s*=\s*/i, '')
      .replace(/^instance\s*[:=]\s*/i, '')
      .replace(/^name\s*[:=]\s*/i, '')
      // Remove quotes
      .replace(/^["']|["']$/g, '')
      // Remove trailing/leading slashes
      .replace(/^\/+|\/+$/g, '')
      // Remove whitespace
      .trim();
  };

  // WhatsApp Settings from new table
  const [waSettings, setWaSettings] = useState<WhatsAppSettings>({
    provider: 'EVOLUTION',
    enabled: false,
    evolution_base_url: '',
    evolution_api_key: '',
    evolution_instance: '',
  });
  const [waLoading, setWaLoading] = useState(false);
  const [waTestResult, setWaTestResult] = useState<WaTestResult | null>(null);
  const [showTunnelWizard, setShowTunnelWizard] = useState(false);

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach((s: any) => {
          // Handle both JSON-stringified and plain values safely
          if (typeof s.value === 'string') {
            try {
              map[s.key] = JSON.parse(s.value);
            } catch {
              // Value is not JSON, use as-is
              map[s.key] = s.value;
            }
          } else {
            map[s.key] = s.value;
          }
        });
        setSettings(map);
      });

    fetchWhatsAppSettings();
  }, []);

  const fetchWhatsAppSettings = async () => {
    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .limit(1)
      .single();

    if (data && !error) {
      setWaSettings({
        id: data.id,
        provider: 'EVOLUTION',
        enabled: data.enabled || false,
        evolution_base_url: data.evolution_base_url || '',
        evolution_api_key: data.evolution_api_key || '',
        evolution_instance: data.evolution_instance || '',
      });
    }
  };

  const save = async (key: string, value: string) => {
    await supabase.from('settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  };

  const saveWithToast = async (key: string, value: string) => {
    setLoading(true);
    await save(key, value);
    toast({ title: 'Configuração salva!' });
    setLoading(false);
  };

  const uploadImage = async (file: File, type: 'logo' | 'background') => {
    const isLogo = type === 'logo';
    isLogo ? setUploadingLogo(true) : setUploadingBackground(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `thank-you/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('posto-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('posto-assets')
        .getPublicUrl(filePath);

      // Save to settings
      const settingKey = isLogo ? 'thank_you_logo_url' : 'thank_you_background_url';
      await save(settingKey, publicUrl);
      setSettings(s => ({ ...s, [settingKey]: publicUrl }));

      toast({ title: `${isLogo ? 'Logo' : 'Imagem de fundo'} enviada!` });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
    } finally {
      isLogo ? setUploadingLogo(false) : setUploadingBackground(false);
    }
  };

  const removeImage = async (type: 'logo' | 'background') => {
    const settingKey = type === 'logo' ? 'thank_you_logo_url' : 'thank_you_background_url';
    await save(settingKey, '');
    setSettings(s => ({ ...s, [settingKey]: '' }));
    toast({ title: `${type === 'logo' ? 'Logo' : 'Imagem de fundo'} removida!` });
  };

  // Save WhatsApp settings to new table
  const saveWhatsAppSettings = async () => {
    setWaLoading(true);
    try {
      // Normalize values before saving
      const cleanBaseUrl = normalizeUrl(waSettings.evolution_base_url);
      const cleanInstance = normalizeInstanceName(waSettings.evolution_instance);
      const cleanApiKey = waSettings.evolution_api_key.trim();

      // Update local state with cleaned values
      setWaSettings(prev => ({
        ...prev,
        evolution_base_url: cleanBaseUrl,
        evolution_instance: cleanInstance,
        evolution_api_key: cleanApiKey,
      }));

      if (waSettings.id) {
        // Update existing
        const { error } = await supabase
          .from('whatsapp_settings')
          .update({
            provider: 'EVOLUTION',
            enabled: waSettings.enabled,
            evolution_base_url: cleanBaseUrl || null,
            evolution_api_key: cleanApiKey || null,
            evolution_instance: cleanInstance || null,
          })
          .eq('id', waSettings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('whatsapp_settings')
          .insert({
            provider: 'EVOLUTION',
            enabled: waSettings.enabled,
            evolution_base_url: cleanBaseUrl || null,
            evolution_api_key: cleanApiKey || null,
            evolution_instance: cleanInstance || null,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setWaSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({ title: 'Configurações do WhatsApp salvas!' });
    } catch (err: any) {
      console.error('Error saving WhatsApp settings:', err);
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    } finally {
      setWaLoading(false);
    }
  };

  // Test WhatsApp API - ALWAYS returns 200 with JSON, never throws
  const testWhatsAppAPI = async () => {
    setTestSending(true);
    setWaTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-test', {
        body: { provider: 'EVOLUTION' },
      });

      // Even if there's an "error" from invoke, try to parse data first
      // Our backend function ALWAYS returns 200 with JSON
      // deno-lint-ignore no-explicit-any
      const result: any = data || {};
      // deno-lint-ignore no-explicit-any
      const details: any = result?.details || {};

      if (error && !data) {
        // True network/invoke error (not from our backend function)
        setWaTestResult({
          ok: false,
          step: 'invoke_error',
          error: error.message || 'Erro ao chamar a API',
        });
        toast({ title: 'Erro no teste', description: error.message, variant: 'destructive' });
        return;
      }

      const connected = Boolean(details?.connected);
      const state = details?.state ? String(details.state) : undefined;
      const humanDetail = result.ok
        ? (connected
            ? '✅ Evolution conectado e pronto para envio!'
            : `⚠️ Instância respondeu (state: ${state || 'unknown'})`)
        : undefined;

      // Set the full result for detailed display
      setWaTestResult({
        ok: result.ok === true,
        step: result.step,
        error: result.error,
        details: result.details,
        checklist: details?.checklist || result.checklist,
        help: details?.help || result.help,
        connected,
        detail: humanDetail,
        provider: 'EVOLUTION',
      });

      if (result.ok) {
        toast({ title: 'Sucesso!', description: humanDetail || 'API conectada!' });
      } else {
        toast({
          title: `Falha: ${result.step || 'teste'}`,
          description: result.error || 'Verifique as configurações',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('Test error:', err);
      setWaTestResult({ 
        ok: false, 
        step: 'catch_error',
        error: err?.message || 'Erro inesperado' 
      });
      toast({ title: 'Erro no teste', description: err?.message, variant: 'destructive' });
    } finally {
      setTestSending(false);
    }
  };

  const handleTunnelComplete = (tunnelUrl: string) => {
    setWaSettings(prev => ({ ...prev, evolution_base_url: normalizeUrl(tunnelUrl) }));
    setShowTunnelWizard(false);
    toast({ title: 'URL aplicada!', description: 'Base URL atualizada com o tunnel. Salve as configurações.' });
  };

  // Demo send test
  const testDemoSend = async () => {
    if (!demoPhone.trim()) {
      toast({ title: 'Preencha o número demo', variant: 'destructive' });
      return;
    }
    if (!demoMessage.trim()) {
      toast({ title: 'Preencha a mensagem demo', variant: 'destructive' });
      return;
    }

    setDemoSending(true);
    setDemoResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { 
          phone: demoPhone.trim(),
          message: demoMessage.trim(),
        },
      });

      const result = data || {};
      setDemoResult(result);

      if (error && !data) {
        setDemoResult({ ok: false, error: error.message });
        toast({ title: 'Erro no envio', description: error.message, variant: 'destructive' });
        return;
      }

      if (result.ok) {
        toast({ title: 'Mensagem enviada!', description: `Para ${result.phone || demoPhone}` });
      } else {
        toast({ 
          title: `Falha: ${result.step || 'envio'}`, 
          description: result.error || 'Verifique as configurações', 
          variant: 'destructive' 
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erro inesperado';
      setDemoResult({ ok: false, error: errMsg });
      toast({ title: 'Erro no envio', description: errMsg, variant: 'destructive' });
    } finally {
      setDemoSending(false);
    }
  };

  return (
    <AdminLayout title="Configurações">
      <div className="space-y-6 max-w-2xl">
        {/* Cloudflare Tunnel Wizard */}
        {showTunnelWizard && (
          <CloudflareTunnelWizard
            onComplete={handleTunnelComplete}
            onClose={() => setShowTunnelWizard(false)}
          />
        )}
        {/* WhatsApp Integration Settings */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              WhatsApp - Integração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider Selection */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Provedor</Label>
                <p className="text-xs text-muted-foreground">Escolha o método de envio</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  Evolution API
                </Badge>
                <span className="text-xs text-muted-foreground">(fixo)</span>
              </div>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label>Habilitar envios</Label>
                <p className="text-xs text-muted-foreground">
                  Ative para permitir envio de mensagens via API
                </p>
              </div>
              <Switch
                checked={waSettings.enabled}
                onCheckedChange={(checked) => 
                  setWaSettings(prev => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            {/* Evolution API Fields */}
            {waSettings.provider === 'EVOLUTION' && (
              <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    Evolution API
                  </Badge>
                  <span className="text-xs text-muted-foreground">WhatsApp Web conectado</span>
                </div>
                
                <div>
                  <Label>Base URL</Label>
                  <Input
                    value={waSettings.evolution_base_url}
                    onChange={(e) => setWaSettings(prev => ({ 
                      ...prev, 
                      evolution_base_url: normalizeUrl(e.target.value) 
                    }))}
                    onBlur={(e) => setWaSettings(prev => ({ 
                      ...prev, 
                      evolution_base_url: normalizeUrl(e.target.value) 
                    }))}
                    placeholder="https://evolution.seudominio.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">URL do servidor Evolution (barras finais removidas automaticamente)</p>
                </div>

                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={waSettings.evolution_api_key}
                    onChange={(e) => setWaSettings(prev => ({ ...prev, evolution_api_key: e.target.value.trim() }))}
                    placeholder="Sua chave de API"
                  />
                </div>

                <div>
                  <Label>Instance Name</Label>
                  <Input
                    value={waSettings.evolution_instance}
                    onChange={(e) => setWaSettings(prev => ({ 
                      ...prev, 
                      evolution_instance: normalizeInstanceName(e.target.value) 
                    }))}
                    onBlur={(e) => setWaSettings(prev => ({ 
                      ...prev, 
                      evolution_instance: normalizeInstanceName(e.target.value) 
                    }))}
                    placeholder="nome-da-instancia"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Apenas o nome da instância (prefixos e caracteres inválidos removidos automaticamente)</p>
                </div>

                {/* Tunnel Wizard Button */}
                <div className="pt-2 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTunnelWizard(true)}
                    className="w-full"
                  >
                    <Cloud className="w-4 h-4 mr-2" />
                    API interna? Configurar Cloudflare Tunnel
                  </Button>
                </div>
              </div>
            )}


            {/* Test Result */}
            {/* Test Result - Enhanced display */}
            {waTestResult && (
              <div className={`p-4 rounded-lg border ${
                waTestResult.ok 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {waTestResult.ok ? (
                    <Wifi className="w-4 h-4 text-green-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${waTestResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {waTestResult.ok 
                      ? (waTestResult.detail || 'Conexão estabelecida!') 
                      : (waTestResult.error || 'Erro desconhecido')
                    }
                  </span>
                </div>
                
                {/* Step indicator */}
                {waTestResult.step && !waTestResult.ok && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Etapa: <code className="bg-muted px-1 rounded">{waTestResult.step}</code>
                  </div>
                )}
                
                {/* Checklist */}
                {waTestResult.checklist && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                    <div className="font-medium mb-1">Checklist:</div>
                    {Object.entries(waTestResult.checklist).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className={val.startsWith('✅') ? 'text-green-600' : val.startsWith('❌') ? 'text-red-600' : ''}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Help / Format examples */}
                {waTestResult.help && !waTestResult.ok && (
                  <div className="mt-2 p-2 bg-blue-500/10 rounded text-xs space-y-1">
                    <div className="font-medium text-blue-700 mb-1">Formato esperado:</div>
                    {Object.entries(waTestResult.help).map(([key, val]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-blue-600 font-medium">{key}:</span>
                        <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs break-all">{val}</code>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Details (collapsible) */}
                {waTestResult.details && !waTestResult.ok && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver detalhes técnicos
                    </summary>
                    <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-xs">
                      {JSON.stringify(waTestResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button onClick={saveWhatsAppSettings} disabled={waLoading}>
                {waLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Salvar</>
                )}
              </Button>
              <Button variant="outline" onClick={testWhatsAppAPI} disabled={testSending}>
                {testSending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testando...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Testar API</>
                )}
              </Button>
            </div>

            {/* Status Badge */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant={waSettings.enabled ? 'default' : 'secondary'}>
                {waSettings.enabled ? 'Ativo' : 'Inativo'}
              </Badge>
              <Badge variant="outline">Evolution API</Badge>
              {waTestResult?.connected && (
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Demo Send Test Card */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Teste de Envio Demo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Número Demo</Label>
                <Input
                  value={demoPhone}
                  onChange={(e) => setDemoPhone(e.target.value)}
                  placeholder="5511999999999"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: 55 + DDD + número (sem espaços)
                </p>
              </div>
              <div>
                <Label>Mensagem Demo</Label>
                <Input
                  value={demoMessage}
                  onChange={(e) => setDemoMessage(e.target.value)}
                  placeholder="Mensagem de teste..."
                />
              </div>
            </div>

            <Button 
              onClick={testDemoSend} 
              disabled={demoSending || !demoPhone.trim()}
              className="w-full sm:w-auto"
            >
              {demoSending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Testar Envio</>
              )}
            </Button>

            {/* Demo Result */}
            {demoResult && (
              <div className={`p-4 rounded-lg border ${
                demoResult.ok 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {demoResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${demoResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {demoResult.ok ? 'Mensagem enviada com sucesso!' : (String(demoResult.error) || 'Erro no envio')}
                  </span>
                </div>

                {demoResult.step && !demoResult.ok && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Etapa: <code className="bg-muted px-1 rounded">{String(demoResult.step)}</code>
                  </div>
                )}

                {demoResult.phone && (
                  <div className="text-xs text-muted-foreground">
                    Telefone normalizado: <code className="bg-muted px-1 rounded">{String(demoResult.phone)}</code>
                  </div>
                )}

                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Ver resposta completa
                  </summary>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-xs">
                    {JSON.stringify(demoResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Status Dashboard */}
        <WhatsAppStatusDashboard />

        <Card>
          <CardHeader><CardTitle>Dados do Posto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome do Posto</Label>
              <Input value={settings.posto_name || ''} onChange={e => setSettings(s => ({ ...s, posto_name: e.target.value }))} />
              <Button size="sm" className="mt-2" onClick={() => save('posto_name', settings.posto_name)} disabled={loading}>
                <Save className="w-4 h-4 mr-1" />Salvar
              </Button>
            </div>
            <div>
              <Label>WhatsApp do Posto (para exibição)</Label>
              <Input value={settings.whatsapp_number || ''} onChange={e => setSettings(s => ({ ...s, whatsapp_number: e.target.value }))} placeholder="5594992961110" />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => save('whatsapp_number', settings.whatsapp_number)} disabled={loading}>
                  <Save className="w-4 h-4 mr-1" />Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Textos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Regras do Sorteio</Label>
              <Textarea value={settings.raffle_rules || ''} onChange={e => setSettings(s => ({ ...s, raffle_rules: e.target.value }))} rows={3} />
              <Button size="sm" className="mt-2" onClick={() => save('raffle_rules', settings.raffle_rules)} disabled={loading}>
                <Save className="w-4 h-4 mr-1" />Salvar
              </Button>
            </div>
            <div>
              <Label>Texto LGPD</Label>
              <Textarea value={settings.lgpd_text || ''} onChange={e => setSettings(s => ({ ...s, lgpd_text: e.target.value }))} rows={3} />
              <Button size="sm" className="mt-2" onClick={() => save('lgpd_text', settings.lgpd_text)} disabled={loading}>
                <Save className="w-4 h-4 mr-1" />Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rating Auto-Response Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Mensagens Automáticas de Avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure as mensagens enviadas automaticamente via WhatsApp após o cliente avaliar o atendimento.
              Use <code className="bg-muted px-1 rounded">{'{{posto}}'}</code> para inserir o nome do posto.
            </p>

            {/* Satisfied (4-5 stars) */}
            <div className="space-y-2 p-4 rounded-lg border border-green-200 bg-green-50/50">
              <Label className="flex items-center gap-2 text-green-700">
                <ThumbsUp className="w-4 h-4" />
                Cliente Satisfeito (4-5 estrelas)
              </Label>
              <Textarea
                value={settings.rating_msg_satisfied || `🌟 *Obrigado pela sua avaliação!*

Ficamos muito felizes em saber que você teve uma ótima experiência no *{{posto}}*! 🎉

Sua satisfação é nossa maior recompensa. Esperamos vê-lo novamente em breve!

💚 Equipe {{posto}}`}
                onChange={e => setSettings(s => ({ ...s, rating_msg_satisfied: e.target.value }))}
                rows={6}
                className="bg-white"
              />
            </div>

            {/* Neutral (3 stars) */}
            <div className="space-y-2 p-4 rounded-lg border border-yellow-200 bg-yellow-50/50">
              <Label className="flex items-center gap-2 text-yellow-700">
                <Smile className="w-4 h-4" />
                Cliente Neutro (3 estrelas)
              </Label>
              <Textarea
                value={settings.rating_msg_neutral || `Olá! 👋

Obrigado por avaliar nosso atendimento no *{{posto}}*.

Estamos sempre buscando melhorar! Se tiver alguma sugestão de como podemos tornar sua experiência ainda melhor, ficaremos felizes em ouvir.

Atenciosamente,
💚 Equipe {{posto}}`}
                onChange={e => setSettings(s => ({ ...s, rating_msg_neutral: e.target.value }))}
                rows={6}
                className="bg-white"
              />
            </div>

            {/* Dissatisfied (1-2 stars) */}
            <div className="space-y-2 p-4 rounded-lg border border-red-200 bg-red-50/50">
              <Label className="flex items-center gap-2 text-red-700">
                <ThumbsDown className="w-4 h-4" />
                Cliente Insatisfeito (1-2 estrelas)
              </Label>
              <Textarea
                value={settings.rating_msg_dissatisfied || `Olá! 😔

Lamentamos saber que sua experiência no *{{posto}}* não foi satisfatória.

🔧 *Queremos resolver isso!*

Sua opinião é muito importante para nós. Por favor, nos conte o que aconteceu para que possamos melhorar e garantir que isso não se repita.

Estamos à disposição para ouvir você e encontrar uma solução.

Atenciosamente,
💚 Equipe {{posto}}`}
                onChange={e => setSettings(s => ({ ...s, rating_msg_dissatisfied: e.target.value }))}
                rows={8}
                className="bg-white"
              />
            </div>

            <Button 
              size="sm" 
              onClick={async () => {
                setLoading(true);
                await Promise.all([
                  save('rating_msg_satisfied', settings.rating_msg_satisfied || ''),
                  save('rating_msg_neutral', settings.rating_msg_neutral || ''),
                  save('rating_msg_dissatisfied', settings.rating_msg_dissatisfied || ''),
                ]);
                toast({ title: 'Mensagens automáticas salvas!' });
                setLoading(false);
              }} 
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-1" />Salvar Mensagens
            </Button>
          </CardContent>
        </Card>

        {/* Thank You Screen Customization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Tela de Agradecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: settings.thank_you_primary_color || '#10b981' }}></span>
                  Cor Primária
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={settings.thank_you_primary_color || '#10b981'} 
                    onChange={e => setSettings(s => ({ ...s, thank_you_primary_color: e.target.value }))}
                    className="w-16 h-10 p-1"
                  />
                  <Input 
                    value={settings.thank_you_primary_color || '#10b981'} 
                    onChange={e => setSettings(s => ({ ...s, thank_you_primary_color: e.target.value }))}
                    placeholder="#10b981"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Heart className="w-4 h-4" style={{ color: settings.thank_you_secondary_color || '#ef4444', fill: settings.thank_you_secondary_color || '#ef4444' }} />
                  Cor do Coração
                </Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={settings.thank_you_secondary_color || '#ef4444'} 
                    onChange={e => setSettings(s => ({ ...s, thank_you_secondary_color: e.target.value }))}
                    className="w-16 h-10 p-1"
                  />
                  <Input 
                    value={settings.thank_you_secondary_color || '#ef4444'} 
                    onChange={e => setSettings(s => ({ ...s, thank_you_secondary_color: e.target.value }))}
                    placeholder="#ef4444"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Título</Label>
              <Input 
                value={settings.thank_you_title || 'Obrigado!'} 
                onChange={e => setSettings(s => ({ ...s, thank_you_title: e.target.value }))}
                placeholder="Obrigado!"
              />
            </div>
            <div>
              <Label>Subtítulo (antes do nome do posto)</Label>
              <Input 
                value={settings.thank_you_subtitle || 'Agradecemos sua visita ao'} 
                onChange={e => setSettings(s => ({ ...s, thank_you_subtitle: e.target.value }))}
                placeholder="Agradecemos sua visita ao"
              />
            </div>
            <div>
              <Label>Mensagem de Agradecimento</Label>
              <Textarea 
                value={settings.thank_you_message || 'Volte sempre! Sua presença é muito importante para nós.'} 
                onChange={e => setSettings(s => ({ ...s, thank_you_message: e.target.value }))}
                placeholder="Volte sempre! Sua presença é muito importante para nós."
                rows={2}
              />
            </div>

            {/* Image uploads */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Logo upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Logo do Posto
                </Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, 'logo');
                  }}
                />
                {settings.thank_you_logo_url ? (
                  <div className="relative inline-block">
                    <img 
                      src={settings.thank_you_logo_url} 
                      alt="Logo do posto" 
                      className="h-20 w-auto rounded-lg border border-border object-contain bg-white"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => removeImage('logo')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Enviar Logo</>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Aparece acima do título</p>
              </div>

              {/* Background upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Imagem de Fundo
                </Label>
                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, 'background');
                  }}
                />
                {settings.thank_you_background_url ? (
                  <div className="relative inline-block">
                    <img 
                      src={settings.thank_you_background_url} 
                      alt="Imagem de fundo" 
                      className="h-20 w-auto rounded-lg border border-border object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => removeImage('background')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => bgInputRef.current?.click()}
                    disabled={uploadingBackground}
                  >
                    {uploadingBackground ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Enviar Fundo</>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Cobre toda a tela</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={async () => {
                  setLoading(true);
                  await Promise.all([
                    save('thank_you_primary_color', settings.thank_you_primary_color || '#10b981'),
                    save('thank_you_secondary_color', settings.thank_you_secondary_color || '#ef4444'),
                    save('thank_you_title', settings.thank_you_title || 'Obrigado!'),
                    save('thank_you_subtitle', settings.thank_you_subtitle || 'Agradecemos sua visita ao'),
                    save('thank_you_message', settings.thank_you_message || 'Volte sempre! Sua presença é muito importante para nós.'),
                  ]);
                  toast({ title: 'Configurações salvas!' });
                  setLoading(false);
                }} 
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-1" />Salvar Tela de Agradecimento
              </Button>
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground mb-3">Pré-visualização:</p>
              <div className="text-center space-y-2">
                <div 
                  className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
                  style={{ backgroundColor: settings.thank_you_primary_color || '#10b981' }}
                >
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <Heart 
                  className="w-6 h-6 mx-auto" 
                  style={{ 
                    color: settings.thank_you_secondary_color || '#ef4444', 
                    fill: settings.thank_you_secondary_color || '#ef4444' 
                  }}
                />
                <p className="font-bold text-lg">{settings.thank_you_title || 'Obrigado!'}</p>
                <p className="text-sm text-muted-foreground">{settings.thank_you_subtitle || 'Agradecemos sua visita ao'}</p>
                <p className="text-sm font-semibold" style={{ color: settings.thank_you_primary_color || '#10b981' }}>
                  {settings.posto_name || 'Nome do Posto'}
                </p>
                <p className="text-xs text-muted-foreground">{settings.thank_you_message || 'Volte sempre!'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
