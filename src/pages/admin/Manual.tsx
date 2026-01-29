import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Play, BookOpen, Download, CheckCircle, Loader2, Users, ClipboardList, 
  Trophy, MessageSquare, Gift, BookMarked, Code, Terminal, Mic, Bot,
  Copy, Check, ChevronDown, ChevronUp, Sparkles, FileText, Settings
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface SystemDoc {
  id: string;
  module_name: string;
  section_title: string;
  content: string;
  code_examples: string | null;
  order_index: number;
}

interface AICommand {
  id: string;
  command_pattern: string;
  command_type: string;
  action_type: string | null;
  description: string;
  example_phrases: string[];
  requires_confirmation: boolean;
}

export default function AdminManual() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demoSteps, setDemoSteps] = useState<string[]>([]);
  const [docs, setDocs] = useState<SystemDoc[]>([]);
  const [commands, setCommands] = useState<AICommand[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadDocumentation();
  }, []);

  const loadDocumentation = async () => {
    setLoadingDocs(true);
    try {
      const [docsResult, commandsResult] = await Promise.all([
        supabase.from('system_documentation').select('*').eq('is_active', true).order('order_index'),
        supabase.from('ai_commands').select('*').eq('is_active', true).order('command_type'),
      ]);

      if (docsResult.data) setDocs(docsResult.data);
      if (commandsResult.data) setCommands(commandsResult.data);
    } catch (error) {
      console.error('Error loading documentation:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast({ title: "Código copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addStep = (step: string) => {
    setDemoSteps(prev => [...prev, step]);
  };

  const runDemo = async () => {
    setLoading(true);
    setDemoSteps([]);

    try {
      addStep("Criando 5 clientes fictícios...");
      const fakePhones = ['5594999001001', '5594999002002', '5594999003003', '5594999004004', '5594999005005'];
      
      for (let i = 0; i < fakePhones.length; i++) {
        await supabase.from('wa_contacts').upsert({
          phone: fakePhones[i],
          name: `Cliente Demo ${i + 1}`,
          opt_in: true,
          opt_in_timestamp: new Date().toISOString(),
        }, { onConflict: 'phone' });
      }
      addStep("✓ 5 clientes criados com sucesso");

      addStep("Criando 5 check-ins fictícios...");
      const paymentMethods = ['pix', 'dinheiro', 'debito', 'credito', 'pix'];
      const frentistas = ['FR01', 'FR02', 'FR01', 'FR02', 'FR01'];
      const valores = [150.00, 80.50, 200.00, 45.00, 120.00];
      const litros = [30, 16, 40, 9, 24];

      for (let i = 0; i < 5; i++) {
        const hoursAgo = Math.floor(Math.random() * 20) + 1;
        const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
        
        await supabase.from('checkins').insert({
          phone: fakePhones[i],
          payment_method: paymentMethods[i],
          attendant_code: frentistas[i],
          amount: valores[i],
          liters: litros[i],
          origin: 'demo',
          tag: 'DEMO',
          is_demo: true,
          created_at: createdAt
        });
      }
      addStep("✓ 5 check-ins criados com sucesso");

      addStep("Criando promoção exemplo...");
      await supabase.from('promotions').insert({
        title: 'Desconto Demo PIX',
        description: 'Ganhe R$0.10 de desconto por litro pagando com PIX',
        type: 'desconto',
        discount_value: 0.10,
        eligible_payments: ['pix'],
        is_active: true,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      addStep("✓ Promoção criada com sucesso");

      addStep("Criando reclamação exemplo...");
      await supabase.from('complaints').insert({
        phone: fakePhones[0],
        message: 'Exemplo de reclamação para demonstração do sistema.',
        status: 'novo'
      });
      addStep("✓ Reclamação criada com sucesso");

      addStep("🎉 Demonstração concluída!");
      toast({ title: 'Demonstração Criada!', description: 'Dados de exemplo inseridos com sucesso.' });

      setTimeout(() => navigate('/admin/captura'), 2000);
    } catch (error) {
      console.error('Erro na demonstração:', error);
      addStep("❌ Erro durante a demonstração");
      toast({ title: "Erro", description: "Ocorreu um erro ao criar a demonstração.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadManual = () => {
    // Generate PDF content
    let content = "# MANUAL DO SISTEMA POSTO 7\n\n";
    content += "## Sistema de Gestão Completo para Postos de Combustível\n\n";
    content += "Data de Geração: " + new Date().toLocaleDateString('pt-BR') + "\n\n";
    content += "---\n\n";

    // Add documentation
    docs.forEach(doc => {
      content += `## ${doc.module_name} - ${doc.section_title}\n\n`;
      content += `${doc.content}\n\n`;
      if (doc.code_examples) {
        content += `### Código/Exemplo:\n\`\`\`\n${doc.code_examples}\n\`\`\`\n\n`;
      }
      content += "---\n\n";
    });

    // Add AI commands
    content += "## COMANDOS DE VOZ DA IA\n\n";
    commands.forEach(cmd => {
      content += `### ${cmd.command_pattern.toUpperCase()}\n`;
      content += `Tipo: ${cmd.command_type}\n`;
      content += `Descrição: ${cmd.description}\n`;
      content += `Exemplos: "${cmd.example_phrases.join('", "')}"\n`;
      content += `Confirmação: ${cmd.requires_confirmation ? 'Sim' : 'Não'}\n\n`;
    });

    // Download as text file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'manual-posto7-completo.md';
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Download Iniciado", description: "Manual completo baixado em formato Markdown." });
  };

  const commandTypeColors: Record<string, string> = {
    action: 'bg-green-500/10 text-green-600',
    query: 'bg-blue-500/10 text-blue-600',
    navigation: 'bg-purple-500/10 text-purple-600',
    settings: 'bg-orange-500/10 text-orange-600',
  };

  return (
    <AdminLayout title="Manual / Documentação Completa">
      <div className="space-y-6">
        {/* Header Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Demo Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Rodar Demonstração
              </CardTitle>
              <CardDescription>Cria dados fictícios para conhecer o sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>5 clientes fictícios</li>
                <li>5 check-ins com dados variados</li>
                <li>1 promoção exemplo ativa</li>
                <li>1 reclamação exemplo</li>
              </ul>

              <Button onClick={runDemo} disabled={loading} size="lg" className="w-full">
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Executando...</> : <><Play className="mr-2 h-5 w-5" />Rodar Demo</>}
              </Button>

              {demoSteps.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
                  {demoSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {step.startsWith('✓') ? <CheckCircle className="h-4 w-4 text-green-500" /> : 
                       step.startsWith('❌') ? <span className="text-red-500">●</span> :
                       step.startsWith('🎉') ? <span>🎉</span> :
                       <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      <span>{step.replace(/^[✓❌🎉]\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Download Manual Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Manual Completo
              </CardTitle>
              <CardDescription>Documentação técnica de todos os módulos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted rounded flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {docs.length} módulos documentados
                </div>
                <div className="p-2 bg-muted rounded flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  {commands.length} comandos IA
                </div>
              </div>

              <Button variant="outline" onClick={downloadManual} size="lg" className="w-full">
                <Download className="mr-2 h-5 w-5" />
                Baixar Manual Completo
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* AI Commands Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Comandos de Voz da IA Superinteligente
            </CardTitle>
            <CardDescription>
              Use estes comandos por voz ou texto no Assistente IA. A IA funciona 24h!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {commands.map(cmd => (
                  <div key={cmd.id} className="p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={commandTypeColors[cmd.command_type] || 'bg-gray-500/10'}>
                        {cmd.command_type}
                      </Badge>
                      {cmd.requires_confirmation && (
                        <Badge variant="outline" className="text-xs">Confirmação</Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm mb-1 capitalize">{cmd.command_pattern}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{cmd.description}</p>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Exemplos: </span>
                      <span className="text-primary italic">"{cmd.example_phrases[0]}"</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentation Accordion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Documentação Técnica dos Módulos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {docs.map(doc => (
                  <AccordionItem key={doc.id} value={doc.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{doc.module_name}</Badge>
                        <span className="font-medium">{doc.section_title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-4">
                        <p className="text-muted-foreground">{doc.content}</p>
                        {doc.code_examples && (
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-muted-foreground">Código/Exemplo:</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => copyCode(doc.code_examples!, doc.id)}
                              >
                                {copiedId === doc.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto font-mono">
                              {doc.code_examples}
                            </pre>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Quick Access */}
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/ia')}>
                <Bot className="h-5 w-5 text-primary" />
                <span className="text-sm">Assistente IA</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/captura')}>
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-sm">Captura</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/producao')}>
                <ClipboardList className="h-5 w-5 text-green-500" />
                <span className="text-sm">Produção</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/sorteios')}>
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-sm">Sorteios</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/promocoes')}>
                <Gift className="h-5 w-5 text-purple-500" />
                <span className="text-sm">Promoções</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/configuracoes')}>
                <Settings className="h-5 w-5 text-gray-500" />
                <span className="text-sm">Config</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}