import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Play, BookOpen, Download, CheckCircle, Loader2, Users, ClipboardList, Trophy, MessageSquare, Gift, BookMarked } from 'lucide-react';

export default function AdminManual() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demoSteps, setDemoSteps] = useState<string[]>([]);

  const addStep = (step: string) => {
    setDemoSteps(prev => [...prev, step]);
  };

  const runDemo = async () => {
    setLoading(true);
    setDemoSteps([]);

    try {
      // 1. Criar clientes fictícios
      addStep("Criando 5 clientes fictícios...");
      const fakePhones = [
        '5594999001001',
        '5594999002002',
        '5594999003003',
        '5594999004004',
        '5594999005005'
      ];
      
      for (let i = 0; i < fakePhones.length; i++) {
        const phone = fakePhones[i];
        await supabase.from('customers').upsert({
          phone,
          name: `Cliente Demo ${i + 1}`,
          accepts_raffle: true,
          accepts_promo: i % 2 === 0,
          lgpd_consent: true,
          lgpd_consent_timestamp: new Date().toISOString(),
          lgpd_version: '1.0'
        }, { onConflict: 'phone' });
      }
      addStep("✓ 5 clientes criados com sucesso");

      // 2. Criar check-ins fictícios
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

      // 3. Criar promoção exemplo
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

      // 4. Criar reclamação exemplo
      addStep("Criando reclamação exemplo...");
      await supabase.from('complaints').insert({
        phone: fakePhones[0],
        message: 'Exemplo de reclamação para demonstração do sistema. Fila muito grande no caixa.',
        status: 'novo'
      });
      addStep("✓ Reclamação criada com sucesso");

      // 5. Executar sorteio teste
      addStep("Executando sorteio teste...");
      const { data: raffle } = await supabase
        .from('raffles')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (raffle) {
        const { data: eligibleCustomers } = await supabase
          .from('customers')
          .select('id, phone, name')
          .eq('accepts_raffle', true)
          .limit(10);

        const winners = (eligibleCustomers || []).slice(0, Math.min(raffle.winners_count || 3, eligibleCustomers?.length || 0));
        
        await supabase.from('raffle_runs').insert({
          raffle_id: raffle.id,
          is_test: true,
          eligible_count: eligibleCustomers?.length || 0,
          winners: winners.map(w => ({ id: w.id, phone: w.phone, name: w.name })),
          seed: `demo_${Date.now()}`,
          executed_by: user?.id
        });
        addStep("✓ Sorteio teste executado");
      } else {
        addStep("⚠ Nenhum sorteio ativo encontrado");
      }

      addStep("🎉 Demonstração concluída!");
      
      toast({ 
        title: 'Demonstração Criada!', 
        description: 'Todos os dados de exemplo foram inseridos com sucesso.' 
      });

      // Aguardar e redirecionar
      setTimeout(() => {
        navigate('/admin/captura');
      }, 2000);

    } catch (error) {
      console.error('Erro na demonstração:', error);
      addStep("❌ Erro durante a demonstração");
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a demonstração.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadManual = () => {
    toast({
      title: "Download",
      description: "Manual em PDF será disponibilizado em breve.",
    });
  };

  return (
    <AdminLayout title="Manual / Demonstração">
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card Demonstração */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Rodar Demonstração
              </CardTitle>
              <CardDescription>
                Cria dados fictícios para você conhecer o sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>A demonstração irá criar:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>5 clientes fictícios</li>
                  <li>5 check-ins com dados variados</li>
                  <li>1 promoção exemplo ativa</li>
                  <li>1 reclamação exemplo</li>
                  <li>1 sorteio teste</li>
                </ul>
              </div>

              <Button 
                onClick={runDemo} 
                disabled={loading}
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Rodar Demonstração
                  </>
                )}
              </Button>

              {/* Progress Steps */}
              {demoSteps.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
                  {demoSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {step.startsWith('✓') ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : step.startsWith('❌') ? (
                        <span className="text-red-500">●</span>
                      ) : step.startsWith('⚠') ? (
                        <span className="text-yellow-500">●</span>
                      ) : step.startsWith('🎉') ? (
                        <span>🎉</span>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      )}
                      <span className={step.startsWith('✓') ? 'text-green-600' : 'text-foreground'}>
                        {step.replace(/^[✓❌⚠🎉]\s*/, '')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Download Manual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Manual do Sistema
              </CardTitle>
              <CardDescription>
                Guia completo de uso do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-muted rounded-lg"><strong>1.</strong> Gere QR codes em "QR Code" com código do frentista.</div>
                <div className="p-3 bg-muted rounded-lg"><strong>2.</strong> Clientes escaneiam e preenchem dados no app.</div>
                <div className="p-3 bg-muted rounded-lg"><strong>3.</strong> Acompanhe em "Captura" e "Produção".</div>
                <div className="p-3 bg-muted rounded-lg"><strong>4.</strong> Configure sorteios e promoções nas respectivas telas.</div>
                <div className="p-3 bg-muted rounded-lg"><strong>5.</strong> Gerencie reclamações em "Atendimento".</div>
                <div className="p-3 bg-muted rounded-lg"><strong>6.</strong> Controle financeiro em "Livro Caixa" com gráfico de evolução e relatório DRE automático.</div>
              </div>
              <Button 
                variant="outline" 
                onClick={downloadManual}
                size="lg"
                className="w-full"
              >
                <Download className="mr-2 h-5 w-5" />
                Baixar Manual PDF
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/atendimento')}>
                <MessageSquare className="h-5 w-5 text-orange-500" />
                <span className="text-sm">Atendimento</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/promocoes')}>
                <Gift className="h-5 w-5 text-purple-500" />
                <span className="text-sm">Promoções</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/livro-caixa')}>
                <BookMarked className="h-5 w-5 text-emerald-500" />
                <span className="text-sm">Livro Caixa</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
