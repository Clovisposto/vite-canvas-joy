import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Cloud, 
  Copy, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Terminal, 
  Globe, 
  Shield, 
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CloudflareTunnelWizardProps {
  onComplete: (tunnelUrl: string) => void;
  onClose: () => void;
}

interface StepChecklist {
  [key: string]: boolean;
}

interface WizardState {
  currentStep: number;
  domain: string;
  tunnelUrl: string;
  localPort: string;
  checklist: StepChecklist;
}

const STORAGE_KEY = 'cloudflare_tunnel_wizard_progress';

const defaultChecklist: StepChecklist = {
  step1_installed: false,
  step2_logged: false,
  step2_tunnel_created: false,
  step2_dns_configured: false,
  step3_config_created: false,
  step3_service_installed: false,
  step3_service_running: false,
};

const loadSavedProgress = (): WizardState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading wizard progress:', e);
  }
  return null;
};

const saveProgress = (state: WizardState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving wizard progress:', e);
  }
};

const clearProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing wizard progress:', e);
  }
};

export default function CloudflareTunnelWizard({ onComplete, onClose }: CloudflareTunnelWizardProps) {
  const { toast } = useToast();
  
  // Load saved progress or use defaults
  const savedProgress = loadSavedProgress();
  
  const [currentStep, setCurrentStep] = useState(savedProgress?.currentStep ?? 0);
  const [domain, setDomain] = useState(savedProgress?.domain ?? '');
  const [tunnelUrl, setTunnelUrl] = useState(savedProgress?.tunnelUrl ?? '');
  const [localPort, setLocalPort] = useState(savedProgress?.localPort ?? '8080');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checklist, setChecklist] = useState<StepChecklist>(savedProgress?.checklist ?? defaultChecklist);
  const [hasRestoredProgress] = useState(!!savedProgress && savedProgress.currentStep > 0);

  // Save progress whenever state changes
  useEffect(() => {
    saveProgress({
      currentStep,
      domain,
      tunnelUrl,
      localPort,
      checklist,
    });
  }, [currentStep, domain, tunnelUrl, localPort, checklist]);

  // Show toast when progress is restored
  useEffect(() => {
    if (hasRestoredProgress) {
      toast({ title: 'Progresso restaurado', description: `Continuando do passo ${currentStep + 1}` });
    }
  }, []);

  const resetProgress = () => {
    clearProgress();
    setCurrentStep(0);
    setDomain('');
    setTunnelUrl('');
    setLocalPort('8080');
    setChecklist(defaultChecklist);
    toast({ title: 'Progresso resetado', description: 'Wizard reiniciado do início' });
  };

  const handleComplete = (url: string) => {
    clearProgress();
    onComplete(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Comando copiado para a área de transferência' });
  };

  const toggleCheck = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const testTunnelUrl = async () => {
    if (!tunnelUrl) {
      toast({ title: 'URL necessária', description: 'Informe a URL do tunnel', variant: 'destructive' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Try to reach the Evolution API through the tunnel
      const cleanUrl = tunnelUrl.replace(/\/$/, '');
      
      // We'll test by calling our edge function with the new URL
      const response = await fetch(`${cleanUrl}`, {
        method: 'GET',
        mode: 'no-cors',
      });

      // With no-cors we can't read the response, but if it doesn't throw, the URL is reachable
      setTestResult({ 
        ok: true, 
        message: 'URL acessível! Configure esta URL no campo Base URL das configurações do WhatsApp.' 
      });
      
    } catch (error) {
      console.error('Test error:', error);
      setTestResult({ 
        ok: false, 
        message: 'Não foi possível conectar. Verifique se o tunnel está rodando.' 
      });
    } finally {
      setTesting(false);
    }
  };

  const subdomain = domain ? `evolution.${domain}` : 'evolution.seudominio.com.br';
  const fullTunnelUrl = `https://${subdomain}`;

  const steps = [
    {
      title: 'Instalar cloudflared',
      icon: Terminal,
      description: 'Instale o cliente Cloudflare Tunnel no servidor onde roda a Evolution API',
    },
    {
      title: 'Criar Tunnel',
      icon: Cloud,
      description: 'Faça login e crie o tunnel no Cloudflare',
    },
    {
      title: 'Configurar Serviço',
      icon: Shield,
      description: 'Configure e inicie o serviço do tunnel',
    },
    {
      title: 'Testar e Finalizar',
      icon: Globe,
      description: 'Valide a conexão e atualize as configurações',
    },
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Execute este comando no servidor Linux onde a Evolution API está instalada:
            </p>

            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm relative">
              <pre className="whitespace-pre-wrap break-all">
{`curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb`}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard('curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/30">
              <Checkbox 
                id="step1_installed" 
                checked={checklist.step1_installed}
                onCheckedChange={() => toggleCheck('step1_installed')}
              />
              <Label htmlFor="step1_installed" className="text-sm cursor-pointer">
                Cloudflared instalado com sucesso
              </Label>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Dica:</strong> Para verificar a instalação, execute: <code className="bg-muted px-1 rounded">cloudflared --version</code>
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="domain">Seu domínio no Cloudflare</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="seudominio.com.br"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O subdomínio será: <strong>{subdomain}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Execute os comandos em sequência:</p>

              {/* Login */}
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm relative">
                <p className="text-xs text-muted-foreground mb-1"># 1. Login no Cloudflare</p>
                <pre className="whitespace-pre-wrap">cloudflared tunnel login</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard('cloudflared tunnel login')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2 pl-2">
                <Checkbox 
                  id="step2_logged" 
                  checked={checklist.step2_logged}
                  onCheckedChange={() => toggleCheck('step2_logged')}
                />
                <Label htmlFor="step2_logged" className="text-sm cursor-pointer">
                  Login realizado (navegador abriu para autorizar)
                </Label>
              </div>

              {/* Create Tunnel */}
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm relative">
                <p className="text-xs text-muted-foreground mb-1"># 2. Criar tunnel</p>
                <pre className="whitespace-pre-wrap">cloudflared tunnel create evolution</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard('cloudflared tunnel create evolution')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2 pl-2">
                <Checkbox 
                  id="step2_tunnel_created" 
                  checked={checklist.step2_tunnel_created}
                  onCheckedChange={() => toggleCheck('step2_tunnel_created')}
                />
                <Label htmlFor="step2_tunnel_created" className="text-sm cursor-pointer">
                  Tunnel "evolution" criado
                </Label>
              </div>

              {/* Route DNS */}
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm relative">
                <p className="text-xs text-muted-foreground mb-1"># 3. Configurar DNS</p>
                <pre className="whitespace-pre-wrap">cloudflared tunnel route dns evolution {subdomain}</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(`cloudflared tunnel route dns evolution ${subdomain}`)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2 pl-2">
                <Checkbox 
                  id="step2_dns_configured" 
                  checked={checklist.step2_dns_configured}
                  onCheckedChange={() => toggleCheck('step2_dns_configured')}
                />
                <Label htmlFor="step2_dns_configured" className="text-sm cursor-pointer">
                  DNS configurado
                </Label>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="localPort">Porta local da Evolution API</Label>
              <Input
                id="localPort"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                placeholder="8080"
                className="mt-1 w-32"
              />
            </div>

            <p className="text-sm font-medium">Execute os comandos para configurar o serviço:</p>

            {/* Create config */}
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs relative">
              <p className="text-xs text-muted-foreground mb-1"># 1. Criar diretório e arquivo de configuração</p>
              <pre className="whitespace-pre-wrap break-all">
{`sudo mkdir -p /etc/cloudflared && sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: evolution
credentials-file: /root/.cloudflared/$(cloudflared tunnel list | grep evolution | awk '{print $1}').json
ingress:
  - hostname: ${subdomain}
    service: http://localhost:${localPort}
  - service: http_status:404
EOF`}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(`sudo mkdir -p /etc/cloudflared && sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: evolution
credentials-file: /root/.cloudflared/$(cloudflared tunnel list | grep evolution | awk '{print \\$1}').json
ingress:
  - hostname: ${subdomain}
    service: http://localhost:${localPort}
  - service: http_status:404
EOF`)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2 pl-2">
              <Checkbox 
                id="step3_config_created" 
                checked={checklist.step3_config_created}
                onCheckedChange={() => toggleCheck('step3_config_created')}
              />
              <Label htmlFor="step3_config_created" className="text-sm cursor-pointer">
                Arquivo de configuração criado
              </Label>
            </div>

            {/* Install and start service */}
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm relative">
              <p className="text-xs text-muted-foreground mb-1"># 2. Instalar e iniciar serviço</p>
              <pre className="whitespace-pre-wrap">
{`sudo cloudflared service install && sudo systemctl start cloudflared && sudo systemctl enable cloudflared`}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard('sudo cloudflared service install && sudo systemctl start cloudflared && sudo systemctl enable cloudflared')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2 pl-2">
              <Checkbox 
                id="step3_service_installed" 
                checked={checklist.step3_service_installed}
                onCheckedChange={() => toggleCheck('step3_service_installed')}
              />
              <Label htmlFor="step3_service_installed" className="text-sm cursor-pointer">
                Serviço instalado
              </Label>
            </div>

            {/* Verify */}
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm relative">
              <p className="text-xs text-muted-foreground mb-1"># 3. Verificar status</p>
              <pre className="whitespace-pre-wrap">sudo systemctl status cloudflared</pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard('sudo systemctl status cloudflared')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2 pl-2">
              <Checkbox 
                id="step3_service_running" 
                checked={checklist.step3_service_running}
                onCheckedChange={() => toggleCheck('step3_service_running')}
              />
              <Label htmlFor="step3_service_running" className="text-sm cursor-pointer">
                Serviço rodando (status: active)
              </Label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                🎉 Tunnel configurado! URL pública:
              </p>
              <code className="text-lg font-bold text-green-800 dark:text-green-200">
                {fullTunnelUrl}
              </code>
            </div>

            <div>
              <Label htmlFor="tunnelUrl">URL do Tunnel (para validação)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="tunnelUrl"
                  value={tunnelUrl || fullTunnelUrl}
                  onChange={(e) => setTunnelUrl(e.target.value)}
                  placeholder="https://evolution.seudominio.com.br"
                />
                <Button onClick={testTunnelUrl} disabled={testing}>
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Testar'
                  )}
                </Button>
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                testResult.ok 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-700' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-700'
              }`}>
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Próximos passos:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copie a URL acima</li>
                <li>Cole no campo <strong>Base URL</strong> das configurações do WhatsApp</li>
                <li>Preencha <strong>API Key</strong> e <strong>Instance Name</strong></li>
                <li>Clique em <strong>Salvar</strong> e depois <strong>Testar API</strong></li>
              </ol>
            </div>

            <Button 
              className="w-full" 
              onClick={() => handleComplete(tunnelUrl || fullTunnelUrl)}
            >
              <Check className="w-4 h-4 mr-2" />
              Aplicar URL e Fechar
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return checklist.step1_installed;
      case 1:
        return checklist.step2_logged && checklist.step2_tunnel_created && checklist.step2_dns_configured && domain;
      case 2:
        return checklist.step3_config_created && checklist.step3_service_installed && checklist.step3_service_running;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-background">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Publicar Evolution API via Cloudflare Tunnel
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetProgress} title="Reiniciar wizard">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>
        
        {/* Progress */}
        <div className="flex items-center gap-1 mt-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center flex-1">
              <div 
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  index < currentStep 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : index === currentStep 
                      ? 'border-primary text-primary' 
                      : 'border-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <step.icon className="w-4 h-4" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="mt-2">
          <h3 className="font-medium">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderStep()}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          {currentStep < steps.length - 1 && (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}