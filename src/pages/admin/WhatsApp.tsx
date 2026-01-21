import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, MessageCircle, Send, Phone, FileText, CheckCircle2, Zap, Inbox, Users, Ban, RefreshCw, Loader2, ExternalLink, Megaphone, Trophy } from 'lucide-react';
import WhatsAppConfirmationsDashboard from '@/components/admin/WhatsAppConfirmationsDashboard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Função para limpar número de telefone
 * Remove parênteses, espaços, traços e qualquer caractere não numérico
 */
const formatPhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Normaliza número para padrão BR (55 + DDD + número)
 */
const normalizePhoneBR = (phone: string): string => {
  const digits = formatPhoneNumber(phone);
  if (!digits) return '';

  // Se já tem DDI
  if (digits.startsWith('55')) return digits;

  // Se veio somente DDD+numero (10/11), prefixa BR
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  // Caso diferente, devolve como está (melhor do que quebrar)
  return digits;
};

const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Gera link do WhatsApp:
 * - Mobile: wa.me
 * - Desktop: web.whatsapp.com (evita bloqueio do api.whatsapp.com em alguns ambientes)
 */
const generateWhatsAppLink = (phone: string, message: string): string => {
  const normalizedPhone = normalizePhoneBR(phone);
  if (!normalizedPhone) return '';

  const encodedMessage = encodeURIComponent(message ?? '');

  return isMobileDevice()
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodedMessage}`;
};

/**
 * Abre WhatsApp em nova aba (com fallback caso o popup seja bloqueado)
 */
const openWhatsApp = (phone: string, message: string): void => {
  const link = generateWhatsAppLink(phone, message);
  if (!link) return;

  const win = window.open(link, '_blank', 'noopener,noreferrer');
  if (!win) {
    // fallback em ambientes que bloqueiam popups
    window.location.href = link;
  }
};

export default function AdminWhatsApp() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [massSending, setMassSending] = useState(false);
  const [massSendProgress, setMassSendProgress] = useState({ current: 0, total: 0 });
  
  const [whatsappNumber, setWhatsappNumber] = useState('5594991324567');
  const [welcomeMessage, setWelcomeMessage] = useState('Olá! Obrigado por participar do programa de fidelidade do Posto 7! 🚗⛽');
  const [promoMessage, setPromoMessage] = useState('🎉 Promoção especial para você! Aproveite os benefícios exclusivos do Posto 7.');
  const [raffleWinnerMessage, setRaffleWinnerMessage] = useState('🎊 Parabéns! Você foi sorteado no nosso programa de fidelidade! Entre em contato conosco para retirar seu prêmio.');
  const [reminderMessage, setReminderMessage] = useState('Olá! Faz um tempo que não nos visitamos. Venha abastecer no Posto 7 e aproveite nossas promoções! ⛽');

  const [messages, setMessages] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [customPromoMessage, setCustomPromoMessage] = useState('🎉 Olá! Temos uma promoção especial para você no Posto 7! Venha conferir! ⛽');
  const [testMessage, setTestMessage] = useState('Teste Posto7 - Envio Rápido');

  useEffect(() => {
    fetchSettings();
    fetchMessages();
    fetchContacts();
    fetchTemplates();
    fetchAiLogs();
  }, []);

  const fetchAiLogs = async () => {
    const { data } = await supabase
      .from('ai_whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAiLogs(data || []);
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('key, value');

      data?.forEach((setting) => {
        const value = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value);
        switch (setting.key) {
          case 'whatsapp_number':
            setWhatsappNumber(value.replace(/"/g, '') || '5594991324567');
            break;
          case 'whatsapp_welcome_message':
            setWelcomeMessage(value.replace(/"/g, ''));
            break;
          case 'whatsapp_promo_message':
            setPromoMessage(value.replace(/"/g, ''));
            break;
          case 'whatsapp_raffle_winner_message':
            setRaffleWinnerMessage(value.replace(/"/g, ''));
            break;
          case 'whatsapp_reminder_message':
            setReminderMessage(value.replace(/"/g, ''));
            break;
        }
      });
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('wa_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setMessages(data || []);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('wa_contacts')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);
    setContacts(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('wa_templates')
      .select('*')
      .order('name');
    setTemplates(data || []);
  };

  const saveSetting = async (key: string, value: string) => {
    await supabase.from('settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('whatsapp_number', whatsappNumber),
        saveSetting('whatsapp_welcome_message', welcomeMessage),
        saveSetting('whatsapp_promo_message', promoMessage),
        saveSetting('whatsapp_raffle_winner_message', raffleWinnerMessage),
        saveSetting('whatsapp_reminder_message', reminderMessage),
      ]);

      toast({ title: 'Configurações salvas', description: 'Todas as configurações do WhatsApp foram atualizadas.' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as configurações.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Enviar via WhatsApp (Mobile: wa.me / Desktop: WhatsApp Web)
  const handleSendViaWhatsAppWeb = async () => {
    const normalizedPhone = normalizePhoneBR(whatsappNumber);

    if (!normalizedPhone) {
      toast({ title: 'Número não configurado', description: 'Informe um número válido.', variant: 'destructive' });
      return;
    }

    // Validação simples para BR (55 + DDD + número)
    if (normalizedPhone.length < 12) {
      toast({
        title: 'Número inválido',
        description: 'Use o formato 55 + DDD + número (ex: 5594991324567).',
        variant: 'destructive',
      });
      return;
    }

    if (!testMessage?.trim()) {
      toast({ title: 'Mensagem vazia', description: 'Digite uma mensagem para enviar.', variant: 'destructive' });
      return;
    }

    const waLink = generateWhatsAppLink(normalizedPhone, testMessage);

    // Registrar intenção no banco
    await supabase.from('ai_whatsapp_logs').insert({
      phone: normalizedPhone,
      message: testMessage,
      whatsapp_link: waLink,
      sent_by: 'admin_test',
      status: 'link_opened',
    });

    // Abrir WhatsApp em nova aba
    openWhatsApp(normalizedPhone, testMessage);

    toast({
      title: '✅ WhatsApp aberto!',
      description: 'Se aparecer uma tela bloqueada, vamos usar o WhatsApp Web automaticamente.',
    });

    fetchAiLogs();
  };

  const toggleOptIn = async (contactId: string, currentOptIn: boolean) => {
    await supabase.from('wa_contacts').update({ 
      opt_in: !currentOptIn,
      [!currentOptIn ? 'opt_in_timestamp' : 'opt_out_timestamp']: new Date().toISOString()
    }).eq('id', contactId);
    fetchContacts();
    toast({ title: !currentOptIn ? 'Contato ativado' : 'Contato bloqueado' });
  };

  // Envio em massa para todos os contatos ativos
  const handleMassSend = async () => {
    const activeContacts = contacts.filter(c => c.opt_in);
    
    if (activeContacts.length === 0) {
      toast({ title: 'Nenhum contato ativo', description: 'Não há contatos ativos para enviar.', variant: 'destructive' });
      return;
    }

    setMassSending(true);
    setMassSendProgress({ current: 0, total: activeContacts.length });

    const logs = activeContacts.map(c => {
      const normalizedPhone = normalizePhoneBR(c.phone || '');
      const waLink = generateWhatsAppLink(normalizedPhone, customPromoMessage);
      return {
        phone: normalizedPhone,
        message: customPromoMessage,
        whatsapp_link: waLink,
        sent_by: 'admin_mass',
        status: 'pending'
      };
    });

    // Inserir todos os logs de uma vez
    await supabase.from('ai_whatsapp_logs').insert(logs);

    // Abrir links com delay para não sobrecarregar
    for (let i = 0; i < activeContacts.length; i++) {
      const c = activeContacts[i];
      const normalizedPhone = normalizePhoneBR(c.phone || '');

      openWhatsApp(normalizedPhone, customPromoMessage);
      setMassSendProgress({ current: i + 1, total: activeContacts.length });
      
      // Delay entre aberturas para evitar bloqueio do navegador
      if (i < activeContacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    toast({ 
      title: '✅ Envio em massa concluído!', 
      description: `${activeContacts.length} conversas do WhatsApp foram abertas.` 
    });

    fetchAiLogs();
    setMassSending(false);
  };

  // Enviar WhatsApp para contato individual
  const handleSendToContact = async (contact: any) => {
    const normalizedPhone = normalizePhoneBR(contact.phone || '');
    const waLink = generateWhatsAppLink(normalizedPhone, customPromoMessage);

    // Registrar no banco
    await supabase.from('ai_whatsapp_logs').insert({
      phone: normalizedPhone,
      message: customPromoMessage,
      whatsapp_link: waLink,
      sent_by: 'admin_promo',
      status: 'link_opened'
    });

    // Abrir WhatsApp
    openWhatsApp(normalizedPhone, customPromoMessage);

    toast({
      title: '✅ WhatsApp aberto!',
      description: `Mensagem preparada para ${contact.name || normalizedPhone}`
    });

    fetchAiLogs();
  };

  if (loading) {
    return (
      <AdminLayout title="Envio Rápido WhatsApp">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Envio Rápido WhatsApp">
      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-7">
          <TabsTrigger value="config" className="flex items-center gap-1">
            <Zap className="w-4 h-4" /> Envio
          </TabsTrigger>
          <TabsTrigger value="confirmations" className="flex items-center gap-1">
            <Trophy className="w-4 h-4" /> Confirmações
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1">
            <FileText className="w-4 h-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="inbox" className="flex items-center gap-1">
            <Inbox className="w-4 h-4" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-1">
            <Users className="w-4 h-4" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="optout" className="flex items-center gap-1">
            <Ban className="w-4 h-4" /> Opt-Out
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Confirmations Tab */}
        <TabsContent value="confirmations">
          <WhatsAppConfirmationsDashboard />
        </TabsContent>

        {/* Config Tab - Envio Rápido */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle>Envio Rápido WhatsApp</CardTitle>
                    <CardDescription>Envie mensagens via WhatsApp Web</CardDescription>
                  </div>
                </div>

                <Badge className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> 🟢 Modo Link Direto Ativo
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">Número do WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="whatsapp"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="5594992961110"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato: código do país + DDD + número (ex: 5594991324567)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testMessage">Mensagem de Teste</Label>
                <Textarea
                  id="testMessage"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Digite a mensagem de teste..."
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleSendViaWhatsAppWeb}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                size="lg"
              >
                <ExternalLink className="h-5 w-5 mr-2" />
                Enviar via WhatsApp Web
              </Button>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                  <MessageCircle className="h-4 w-4" />
                  Como funciona
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Clique no botão para abrir o WhatsApp Web</li>
                  <li>• A mensagem já estará preenchida automaticamente</li>
                  <li>• Clique em "Enviar" na conversa do WhatsApp</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelos de Mensagens</CardTitle>
              <CardDescription>Configure as mensagens padrão para cada tipo de comunicação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Mensagem de Boas-vindas</Label>
                <Textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={3} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Mensagem de Promoção</Label>
                <Textarea value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} rows={3} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Mensagem de Ganhador de Sorteio</Label>
                <Textarea value={raffleWinnerMessage} onChange={(e) => setRaffleWinnerMessage(e.target.value)} rows={3} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Mensagem de Lembrete</Label>
                <Textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveAll} disabled={saving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Templates WhatsApp</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchTemplates}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{t.body}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'approved' ? 'default' : 'secondary'}>
                          {t.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inbox Tab */}
        <TabsContent value="inbox">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mensagens Recentes</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchMessages}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.phone}</TableCell>
                      <TableCell>
                        <Badge variant={m.direction === 'inbound' ? 'default' : 'secondary'}>
                          {m.direction === 'inbound' ? '⬇️ Entrada' : '⬆️ Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{m.content}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'sent' ? 'default' : m.status === 'failed' ? 'destructive' : 'secondary'}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Mensagem de Promoção Personalizada
              </CardTitle>
              <CardDescription>
                Defina a mensagem que será enviada ao clicar em "Abrir WhatsApp"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={customPromoMessage} 
                onChange={(e) => setCustomPromoMessage(e.target.value)} 
                rows={3}
                placeholder="Digite a mensagem promocional..."
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground">
                💡 Esta mensagem será usada para todos os envios rápidos via WhatsApp.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Contatos WhatsApp</CardTitle>
                <CardDescription>
                  {contacts.filter(c => c.opt_in).length} contatos ativos de {contacts.length} total
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleMassSend}
                  disabled={massSending || contacts.filter(c => c.opt_in).length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {massSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Abrindo {massSendProgress.current}/{massSendProgress.total}...
                    </>
                  ) : (
                    <>
                      <Megaphone className="h-4 w-4 mr-2" />
                      Abrir WhatsApp para Todos ({contacts.filter(c => c.opt_in).length})
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={fetchContacts}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Opt-In</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.phone}</TableCell>
                      <TableCell>{c.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={c.opt_in ? 'default' : 'destructive'}>
                          {c.opt_in ? '✅ Ativo' : '❌ Bloqueado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(c.updated_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm"
                            onClick={() => handleSendToContact(c)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> Abrir WhatsApp
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleOptIn(c.id, c.opt_in)}
                          >
                            {c.opt_in ? 'Bloquear' : 'Ativar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contacts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum contato cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opt-Out Tab */}
        <TabsContent value="optout">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Opt-Out</CardTitle>
              <CardDescription>Contatos que optaram por não receber mensagens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <h4 className="font-medium mb-2">Palavras-chave de Opt-Out</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge>SAIR</Badge>
                  <Badge>STOP</Badge>
                  <Badge>PARAR</Badge>
                  <Badge>CANCELAR</Badge>
                  <Badge>REMOVER</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Quando um contato envia uma dessas palavras, ele é automaticamente bloqueado.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Palavras-chave de Opt-In</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">ENTRAR</Badge>
                  <Badge variant="secondary">START</Badge>
                  <Badge variant="secondary">INICIAR</Badge>
                  <Badge variant="secondary">VOLTAR</Badge>
                  <Badge variant="secondary">ACEITAR</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Contatos bloqueados podem se reinscrever enviando uma dessas palavras.
                </p>
              </div>

              <Separator className="my-4" />

              <h4 className="font-medium mb-4">Contatos Bloqueados</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.filter(c => !c.opt_in).map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.phone}</TableCell>
                      <TableCell>{c.opt_out_reason || 'Manual'}</TableCell>
                      <TableCell>
                        {c.opt_out_timestamp ? format(new Date(c.opt_out_timestamp), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleOptIn(c.id, false)}>
                          Reativar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contacts.filter(c => !c.opt_in).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum contato bloqueado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>Registro de mensagens enviadas via WhatsApp</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAiLogs}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiLogs.map(log => {
                    const waLink = generateWhatsAppLink(log.phone, log.message);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono">{log.phone}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.sent_by}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'link_opened' ? 'default' : 'secondary'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-medium text-sm"
                          >
                            <ExternalLink className="h-4 w-4" /> Abrir
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {aiLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum envio registrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
