import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Zap, Send, Users, Loader2, MessageCircle, Clock, CheckCircle, Search, Calendar, X, History, AlertTriangle, Pause, Play, Shield, Edit2, Copy, StopCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminPromocoes() {
  const { toast } = useToast();
  const [promos, setPromos] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', type: 'informativa', discount_value: '', is_active: false });
  
  // Flash promo state
  const [flashForm, setFlashForm] = useState({ title: '', message: '', discount_value: '' });
  const [customersCount, setCustomersCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [flashPromos, setFlashPromos] = useState<any[]>([]);
  
  // Settings - WhatsApp number from Configurações
  const [configuredWhatsAppNumber, setConfiguredWhatsAppNumber] = useState<string>('');
  
  // WhatsApp auto sending state
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [allCustomers, setAllCustomers] = useState<{ phone: string; name: string | null; created_at: string | null }[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [customersList, setCustomersList] = useState<{ phone: string; name: string | null; created_at: string | null }[]>([]);
  const [currentContactIndex, setCurrentContactIndex] = useState(0);
  const [manualMessage, setManualMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isAutoSending, setIsAutoSending] = useState(false);
  const isAutoSendingRef = useRef(false);
  const [sentContacts, setSentContacts] = useState<number[]>([]);
  const [dialogStep, setDialogStep] = useState<'select' | 'send'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dispatchHistory, setDispatchHistory] = useState<any[]>([]);
  
  // Anti-bloqueio: estados
  const [messagesThisHour, setMessagesThisHour] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'waiting' | 'opening' | 'typing' | 'sending' | 'delay'>('waiting');
  const [errorContacts, setErrorContacts] = useState<number[]>([]);
  const hourStartRef = useRef<number>(Date.now());
  
  // Evolution API sending
  const [isSendingViaAPI, setIsSendingViaAPI] = useState(false);
  
  // Constantes anti-bloqueio
  const MAX_MESSAGES_PER_HOUR = 40;
  const MIN_DELAY = 25; // segundos
  const MAX_DELAY = 70; // segundos
  const OPEN_CHAT_DELAY_MIN = 6; // segundos
  const OPEN_CHAT_DELAY_MAX = 12; // segundos
  const TYPING_DELAY_MIN = 2; // segundos
  const TYPING_DELAY_MAX = 4; // segundos

  useEffect(() => { 
    fetchPromos(); 
    fetchCustomersCount();
    fetchFlashPromos();
    fetchDispatchHistory();
    fetchConfiguredWhatsAppNumber();
  }, []);

  const fetchConfiguredWhatsAppNumber = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'whatsapp_number').single();
    if (data?.value) {
      const value = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      setConfiguredWhatsAppNumber(value);
    }
  };

  const fetchPromos = async () => {
    const { data } = await supabase.from('promotions').select('*').eq('type', 'informativa').order('created_at', { ascending: false });
    setPromos(data || []);
  };

  const fetchFlashPromos = async () => {
    const { data } = await supabase.from('promotions').select('*').eq('type', 'relampago').order('created_at', { ascending: false });
    setFlashPromos(data || []);
  };

  const fetchDispatchHistory = async () => {
    const { data } = await supabase.from('dispatch_history').select('*').order('created_at', { ascending: false }).limit(50);
    setDispatchHistory(data || []);
  };

  const fetchCustomersCount = async () => {
    const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('accepts_promo', true);
    setCustomersCount(count || 0);
  };

  const createPromo = async () => {
    if (!form.title) return;
    await supabase.from('promotions').insert({ ...form, discount_value: form.discount_value ? parseFloat(form.discount_value) : null });
    toast({ title: 'Promoção criada!' });
    setForm({ title: '', description: '', type: 'informativa', discount_value: '', is_active: false });
    fetchPromos();
  };

  const createAndSendFlashPromo = async () => {
    if (!flashForm.title || !flashForm.message) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      // Create the flash promo
      const { data: promo, error: promoError } = await supabase.from('promotions').insert({
        title: flashForm.title,
        description: flashForm.message,
        type: 'relampago',
        discount_value: flashForm.discount_value ? parseFloat(flashForm.discount_value) : null,
        is_active: true,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }).select().single();

      if (promoError) throw promoError;

      // Get all customers who accept promos
      const { data: customers } = await supabase.from('customers').select('id, phone, name').eq('accepts_promo', true);

      if (customers && customers.length > 0) {
        const message = `🔥 PROMOÇÃO RELÂMPAGO! 🔥\n\n${flashForm.title}\n\n${flashForm.message}${flashForm.discount_value ? `\n\n💰 Desconto: R$ ${flashForm.discount_value}` : ''}\n\n⏰ Válido por 24 horas!`;

        // Create message queue entries
        const messages = customers.map(customer => ({
          customer_id: customer.id,
          phone: customer.phone,
          promotion_id: promo.id,
          message,
          status: 'pending'
        }));

        await supabase.from('messages_queue').insert(messages);

        // Send via Cloud API only
        toast({ title: 'Enviando mensagens...', description: 'Aguarde o envio automático via WhatsApp.' });

        const { data: result, error: sendError } = await supabase.functions.invoke('wa-send', {
          body: {
            customers: customers.map((c) => ({ phone: c.phone, name: c.name })),
            message,
          },
        });

        const configError = result?.total && result?.failed === result?.total && result?.errors?.[0]?.error;

        if (sendError || configError) {
          const realError = configError || sendError?.message || 'Erro desconhecido';
          console.error('Error sending via WA API:', sendError || realError);
          toast({
            title: 'Erro no envio automático',
            description: realError,
            variant: 'destructive',
          });
        } else {
          // Update message queue status
          await supabase
            .from('messages_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('promotion_id', promo.id);

          toast({
            title: 'Promoção enviada com sucesso!',
            description: `${result?.sent || 0} mensagens enviadas, ${result?.failed || 0} falhas, ${result?.skipped || 0} opt-out.`,
          });
        }
      } else {
        toast({ title: 'Promoção criada', description: 'Nenhum cliente cadastrado para receber.' });
      }

      setFlashForm({ title: '', message: '', discount_value: '' });
      fetchFlashPromos();
    } catch (error) {
      console.error('Error creating flash promo:', error);
      toast({ title: 'Erro ao criar promoção', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('promotions').update({ is_active: active }).eq('id', id);
    fetchPromos();
    fetchFlashPromos();
  };

  const deletePromo = async (id: string, isFlash = false) => {
    await supabase.from('promotions').delete().eq('id', id);
    if (isFlash) {
      fetchFlashPromos();
    } else {
      fetchPromos();
    }
  };

  const startManualWhatsApp = async () => {
    if (!flashForm.title || !flashForm.message) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' });
      return;
    }

    const { data: customers } = await supabase
      .from('customers')
      .select('phone, name, created_at')
      .eq('accepts_promo', true)
      .order('created_at', { ascending: false });

    if (!customers || customers.length === 0) {
      toast({ title: 'Nenhum cliente encontrado', variant: 'destructive' });
      return;
    }

    const message = `🔥 PROMOÇÃO RELÂMPAGO! 🔥\n\n${flashForm.title}\n\n${flashForm.message}${flashForm.discount_value ? `\n\n💰 Desconto: R$ ${flashForm.discount_value}` : ''}\n\n⏰ Válido por 24 horas!`;
    
    setManualMessage(message);
    setAllCustomers(customers);
    setSelectedContacts(new Set(customers.map((_, i) => i))); // Selecionar todos por padrão
    setDialogStep('select');
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setShowWhatsAppDialog(true);
  };

  // Confirmar seleção e enviar mensagem para o contato selecionado via WhatsApp Web
  const confirmSelection = () => {
    const selected = allCustomers.filter((_, i) => selectedContacts.has(i));
    if (selected.length === 0) {
      toast({ title: 'Selecione pelo menos um contato', variant: 'destructive' });
      return;
    }
    
    // Verificar se há número WhatsApp configurado
    if (!configuredWhatsAppNumber) {
      toast({ 
        title: 'WhatsApp não configurado', 
        description: 'Configure o número de WhatsApp no menu Configurações.',
        variant: 'destructive' 
      });
      return;
    }
    
    // Enviar para o primeiro contato selecionado via WhatsApp Web
    const contact = selected[0];
    const phone = formatPhoneInternational(contact.phone);
    const encodedMessage = encodeURIComponent(manualMessage);
    
    // Abrir WhatsApp Web usando o número configurado no navegador
    const waUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
    window.open(waUrl, '_blank');
    
    // Se houver mais contatos, configurar lista para envios subsequentes
    if (selected.length > 1) {
      setCustomersList(selected.slice(1)); // Remover o primeiro que já foi enviado
      setCurrentContactIndex(0);
      setSentContacts([0]); // Marcar primeiro como enviado
      setDialogStep('send');
      toast({ 
        title: 'Primeira mensagem enviada!', 
        description: `Restam ${selected.length - 1} contatos para enviar.` 
      });
    } else {
      // Apenas um contato, fechar dialog
      toast({ title: 'Mensagem enviada!', description: 'WhatsApp Web aberto para o contato.' });
      resetWhatsAppDialog();
    }
  };

  // Toggle seleção de contato
  const toggleContact = (index: number) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Selecionar/deselecionar todos (baseado nos filtrados)
  const toggleAllContacts = () => {
    const filteredIndices = filteredCustomers.map(c => allCustomers.findIndex(ac => ac.phone === c.phone));
    const allFilteredSelected = filteredIndices.every(i => selectedContacts.has(i));
    
    if (allFilteredSelected) {
      // Deselecionar todos os filtrados
      setSelectedContacts(prev => {
        const newSet = new Set(prev);
        filteredIndices.forEach(i => newSet.delete(i));
        return newSet;
      });
    } else {
      // Selecionar todos os filtrados
      setSelectedContacts(prev => {
        const newSet = new Set(prev);
        filteredIndices.forEach(i => newSet.add(i));
        return newSet;
      });
    }
  };

  // Filtrar contatos por busca e data
  const filteredCustomers = allCustomers.filter((c) => {
    // Filtro de texto
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || (c.name?.toLowerCase().includes(term) || c.phone.includes(term));
    
    // Filtro de data
    let matchesDate = true;
    if (c.created_at) {
      const customerDate = new Date(c.created_at);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && customerDate >= fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && customerDate <= toDate;
      }
    }
    
    return matchesSearch && matchesDate;
  });

  // Limpar filtros de data
  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  // Formatar telefone para formato internacional brasileiro
  const formatPhoneInternational = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    // Se já começa com 55, retorna apenas os números
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      return cleaned;
    }
    // Adiciona 55 se não tiver
    return `55${cleaned}`;
  };

  // Abrir WhatsApp Web para um contato específico
  const openWhatsAppForContact = (index: number) => {
    if (index >= customersList.length) return;
    
    const contact = customersList[index];
    const phone = formatPhoneInternational(contact.phone);
    const encodedMessage = encodeURIComponent(manualMessage);
    
    // Abre WhatsApp Web (navegador Google Chrome)
    const waUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
    window.open(waUrl, '_blank');
    
    setSentContacts(prev => [...prev, index]);
  };

  // Salvar histórico de disparo
  const saveDispatchHistory = async (sentCount: number, status: string = 'completed') => {
    try {
      await supabase.from('dispatch_history').insert({
        promotion_title: flashForm.title,
        message: manualMessage,
        total_contacts: customersList.length,
        sent_count: sentCount,
        failed_count: errorContacts.length,
        status
      });
      fetchDispatchHistory();
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  // Gerar delay aleatório entre min e max
  const getRandomDelay = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // Detectar se é mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Verificar limite de mensagens por hora
  const checkHourlyLimit = () => {
    const now = Date.now();
    const hourPassed = now - hourStartRef.current >= 3600000; // 1 hora em ms
    
    if (hourPassed) {
      // Reset contador
      hourStartRef.current = now;
      setMessagesThisHour(0);
      return true;
    }
    
    return messagesThisHour < MAX_MESSAGES_PER_HOUR;
  };

  // Iniciar envio automático com anti-bloqueio
  const startAutoSending = async () => {
    if (customersList.length === 0) return;
    
    // Verificar limite
    if (!checkHourlyLimit()) {
      setIsPaused(true);
      toast({
        title: 'Limite de segurança atingido',
        description: `Máximo de ${MAX_MESSAGES_PER_HOUR} mensagens por hora. Aguarde para continuar.`,
        variant: 'destructive'
      });
      return;
    }
    
    setIsAutoSending(true);
    isAutoSendingRef.current = true;
    setIsPaused(false);
    setErrorContacts([]);
    
    let currentIndex = sentContacts.length; // Continuar de onde parou
    
    const sendNextMessage = async () => {
      // Verifica se deve continuar
      if (!isAutoSendingRef.current) {
        saveDispatchHistory(sentContacts.length, 'paused');
        setCurrentPhase('waiting');
        return;
      }
      
      // Verificar limite horário
      if (messagesThisHour >= MAX_MESSAGES_PER_HOUR) {
        setIsPaused(true);
        setIsAutoSending(false);
        isAutoSendingRef.current = false;
        setCurrentPhase('waiting');
        toast({
          title: 'Pausa de segurança',
          description: `${MAX_MESSAGES_PER_HOUR} mensagens enviadas. Aguarde 1 hora para continuar.`,
          variant: 'destructive'
        });
        saveDispatchHistory(sentContacts.length, 'paused_limit');
        return;
      }
      
      if (currentIndex >= customersList.length) {
        // Finalizado
        setIsAutoSending(false);
        isAutoSendingRef.current = false;
        setCountdown(0);
        setCurrentContactIndex(customersList.length);
        setCurrentPhase('waiting');
        saveDispatchHistory(customersList.length, 'completed');
        toast({ 
          title: 'Envio concluído!', 
          description: `${customersList.length} mensagens enviadas automaticamente.` 
        });
        return;
      }
      
      const contact = customersList[currentIndex];
      setCurrentContactIndex(currentIndex);
      
      // FASE 1: Simulação de abertura do chat (6-12 segundos)
      setCurrentPhase('opening');
      const openDelay = getRandomDelay(OPEN_CHAT_DELAY_MIN, OPEN_CHAT_DELAY_MAX);
      
      for (let i = openDelay; i > 0; i--) {
        if (!isAutoSendingRef.current) return;
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // FASE 2: Simulação de digitação (2-4 segundos)
      setCurrentPhase('typing');
      const typeDelay = getRandomDelay(TYPING_DELAY_MIN, TYPING_DELAY_MAX);
      
      for (let i = typeDelay; i > 0; i--) {
        if (!isAutoSendingRef.current) return;
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // FASE 3: Envio
      setCurrentPhase('sending');
      
      try {
        const phone = formatPhoneInternational(contact.phone);
        const encodedMessage = encodeURIComponent(manualMessage);
        
        // Usar wa.me para mobile, web.whatsapp.com para desktop
        const waUrl = isMobile() 
          ? `https://wa.me/${phone}?text=${encodedMessage}`
          : `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
        
        window.open(waUrl, '_blank');
        
        setSentContacts(prev => [...prev, currentIndex]);
        setMessagesThisHour(prev => prev + 1);
      } catch (error) {
        console.error('Erro ao enviar:', error);
        setErrorContacts(prev => [...prev, currentIndex]);
      }
      
      currentIndex++;
      
      if (currentIndex < customersList.length && isAutoSendingRef.current) {
        // FASE 4: Delay inteligente entre mensagens (25-70 segundos)
        setCurrentPhase('delay');
        const delayBetween = getRandomDelay(MIN_DELAY, MAX_DELAY);
        
        for (let i = delayBetween; i > 0; i--) {
          if (!isAutoSendingRef.current) {
            saveDispatchHistory(sentContacts.length + 1, 'paused');
            setCurrentPhase('waiting');
            return;
          }
          setCountdown(i);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Próxima mensagem
        sendNextMessage();
      } else if (currentIndex >= customersList.length) {
        // Último contato
        setIsAutoSending(false);
        isAutoSendingRef.current = false;
        setCountdown(0);
        setCurrentPhase('waiting');
        saveDispatchHistory(customersList.length, 'completed');
        toast({ 
          title: 'Envio concluído!', 
          description: `${customersList.length} mensagens enviadas automaticamente.` 
        });
      }
    };
    
    // Iniciar sequência
    sendNextMessage();
  };

  // Parar envio automático
  const stopAutoSending = () => {
    setIsAutoSending(false);
    isAutoSendingRef.current = false;
    setCountdown(0);
    setCurrentPhase('waiting');
    if (sentContacts.length > 0) {
      saveDispatchHistory(sentContacts.length, 'paused');
    }
  };

  // Continuar envio após pausa
  const resumeAutoSending = () => {
    if (sentContacts.length < customersList.length) {
      setIsPaused(false);
      startAutoSending();
    }
  };

  // Resetar estado do dialog
  const resetWhatsAppDialog = () => {
    setShowWhatsAppDialog(false);
    setCurrentContactIndex(0);
    setSentContacts([]);
    setIsAutoSending(false);
    isAutoSendingRef.current = false;
    setCountdown(0);
    setDialogStep('select');
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setSelectedContacts(new Set());
    setAllCustomers([]);
    setCurrentPhase('waiting');
    setErrorContacts([]);
    setIsPaused(false);
  };

  // Enviar via Evolution API
  const sendViaEvolutionAPI = async () => {
    if (customersList.length === 0) return;
    
    setIsSendingViaAPI(true);
    let sentCount = 0;
    const errors: number[] = [];
    
    for (let i = sentContacts.length; i < customersList.length; i++) {
      const contact = customersList[i];
      setCurrentContactIndex(i);
      
      try {
        const { data, error } = await supabase.functions.invoke('whatsapp-send', {
          body: { 
            to: contact.phone, 
            message: manualMessage 
          },
        });
        
        if (error || !data?.ok) {
          console.error('Erro ao enviar:', error || data?.error);
          errors.push(i);
          setErrorContacts(prev => [...prev, i]);
        } else {
          sentCount++;
          setSentContacts(prev => [...prev, i]);
        }
        
        // Delay de 1 segundo entre mensagens
        if (i < customersList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error('Erro:', err);
        errors.push(i);
        setErrorContacts(prev => [...prev, i]);
      }
    }
    
    setIsSendingViaAPI(false);
    
    if (sentCount > 0) {
      saveDispatchHistory(sentCount, errors.length > 0 ? 'partial' : 'completed');
      toast({ 
        title: 'Envio concluído!', 
        description: `${sentCount} mensagens enviadas${errors.length > 0 ? `, ${errors.length} erros` : ''}.`
      });
    } else {
      toast({ 
        title: 'Falha no envio', 
        description: 'Nenhuma mensagem foi enviada. Verifique as configurações do WhatsApp.',
        variant: 'destructive'
      });
    }
  };

  // Texto da fase atual
  const getPhaseText = () => {
    switch (currentPhase) {
      case 'opening': return 'Abrindo chat...';
      case 'typing': return 'Preparando mensagem...';
      case 'sending': return 'Enviando...';
      case 'delay': return 'Aguardando próximo envio...';
      default: return 'Aguardando...';
    }
  };

  return (
    <AdminLayout title="Promoções">
      <Tabs defaultValue="normal" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="normal">Promoções</TabsTrigger>
          <TabsTrigger value="flash" className="flex items-center gap-2">
            <Zap className="w-4 h-4" /> Relâmpago
          </TabsTrigger>
        </TabsList>

        <TabsContent value="normal">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Nova Promoção</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>Valor Desconto (R$)</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={c => setForm(f => ({ ...f, is_active: c }))} /><Label>Ativa</Label></div>
                <Button onClick={createPromo}><Plus className="w-4 h-4 mr-2" />Criar</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Promoções ({promos.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {promos.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div><p className="font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{p.description}</p></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active} onCheckedChange={c => toggleActive(p.id, c)} />
                      <Button variant="ghost" size="icon" onClick={() => deletePromo(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
                {promos.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Nenhuma promoção cadastrada</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="flash">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Nova Promoção Relâmpago
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{customersCount} clientes receberão a mensagem</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título da Promoção</Label>
                  <Input 
                    placeholder="Ex: Desconto especial hoje!" 
                    value={flashForm.title} 
                    onChange={e => setFlashForm(f => ({ ...f, title: e.target.value }))} 
                  />
                </div>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea 
                    placeholder="Descreva a promoção que será enviada aos clientes..."
                    value={flashForm.message} 
                    onChange={e => setFlashForm(f => ({ ...f, message: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Valor do Desconto (R$) - Opcional</Label>
                  <Input 
                    type="number" 
                    placeholder="0,00"
                    value={flashForm.discount_value} 
                    onChange={e => setFlashForm(f => ({ ...f, discount_value: e.target.value }))} 
                  />
                </div>
                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">⚡ Disparo em massa via API</p>
                  <p className="text-amber-700 dark:text-amber-300">A mensagem será enviada automaticamente para todos os {customersCount} clientes. Válido por 24 horas.</p>
                </div>
                <Button 
                  onClick={createAndSendFlashPromo} 
                  disabled={isSending || !flashForm.title || !flashForm.message}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  {isSending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Criar e Enviar para {customersCount} clientes</>
                  )}
                </Button>
                {isSending && (
                  <Button 
                    onClick={() => setIsSending(false)}
                    variant="destructive"
                    className="w-full"
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    Parar Envio
                  </Button>
                )}
                <Button 
                  onClick={startManualWhatsApp} 
                  disabled={!flashForm.title || !flashForm.message || isSending}
                  variant="outline"
                  className="w-full border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Enviar via WhatsApp do Sistema
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Promoções Relâmpago ({flashPromos.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {flashPromos.map(p => (
                  <div key={p.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <p className="font-medium">{p.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Editar e Repetir"
                          onClick={() => {
                            setFlashForm({
                              title: p.title,
                              message: p.description || '',
                              discount_value: p.discount_value?.toString() || ''
                            });
                            toast({ title: 'Promoção carregada!', description: 'Edite os campos e envie novamente.' });
                          }}
                        >
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Repetir Promoção"
                          onClick={() => {
                            setFlashForm({
                              title: p.title + ' (cópia)',
                              message: p.description || '',
                              discount_value: p.discount_value?.toString() || ''
                            });
                            toast({ title: 'Promoção copiada!', description: 'Altere o título e envie.' });
                          }}
                        >
                          <Copy className="w-4 h-4 text-green-500" />
                        </Button>
                        <Switch checked={p.is_active} onCheckedChange={c => toggleActive(p.id, c)} />
                        <Button variant="ghost" size="icon" onClick={() => deletePromo(p.id, true)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    {p.discount_value && (
                      <p className="text-xs font-medium text-green-600">Desconto: R$ {p.discount_value}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Criado em: {new Date(p.created_at).toLocaleDateString('pt-BR')} às {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
                {flashPromos.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhuma promoção relâmpago enviada</p>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Disparos */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico de Disparos em Massa ({dispatchHistory.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dispatchHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Data/Hora</th>
                          <th className="text-left py-2 px-2">Promoção</th>
                          <th className="text-center py-2 px-2">Total</th>
                          <th className="text-center py-2 px-2">Enviados</th>
                          <th className="text-center py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchHistory.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 px-2 text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString('pt-BR')} {new Date(d.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-2 font-medium">{d.promotion_title}</td>
                            <td className="py-2 px-2 text-center">{d.total_contacts}</td>
                            <td className="py-2 px-2 text-center text-green-600">{d.sent_count}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                d.status === 'completed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : d.status === 'paused'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                              }`}>
                                {d.status === 'completed' ? 'Concluído' : d.status === 'paused' ? 'Pausado' : d.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhum disparo realizado</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Auto Sending Dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={resetWhatsAppDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              {dialogStep === 'select' ? 'Selecionar Contatos' : 'Envio Automático via WhatsApp'}
            </DialogTitle>
            <DialogDescription>
              {dialogStep === 'select' 
                ? 'Selecione os contatos que receberão a mensagem.'
                : `Sistema anti-bloqueio: delays de ${MIN_DELAY}-${MAX_DELAY}s entre envios, máx ${MAX_MESSAGES_PER_HOUR} msg/hora.`
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* STEP 1: Select contacts */}
          {dialogStep === 'select' && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Date filters */}
              <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    Filtrar por data de cadastro
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearDateFilters}
                      className="h-6 px-2 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <Input 
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <Input 
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Select all */}
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedContacts.has(allCustomers.findIndex(ac => ac.phone === c.phone)))}
                    onCheckedChange={toggleAllContacts}
                  />
                  <Label className="cursor-pointer" onClick={toggleAllContacts}>
                    Selecionar todos ({filteredCustomers.length} visíveis)
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedContacts.size} selecionados
                </span>
              </div>

              {/* Contacts list */}
              <ScrollArea className="flex-1 max-h-[250px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredCustomers.map((customer) => {
                    const originalIndex = allCustomers.findIndex(c => c.phone === customer.phone);
                    return (
                      <div 
                        key={customer.phone}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                          selectedContacts.has(originalIndex) ? 'bg-green-50 dark:bg-green-950/20' : ''
                        }`}
                        onClick={() => toggleContact(originalIndex)}
                      >
                        <Checkbox 
                          checked={selectedContacts.has(originalIndex)}
                          onCheckedChange={() => toggleContact(originalIndex)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{customer.name || 'Sem nome'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">{customer.phone}</span>
                            {customer.created_at && (
                              <span className="text-xs">• {new Date(customer.created_at).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredCustomers.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Nenhum contato encontrado</p>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  onClick={confirmSelection}
                  disabled={selectedContacts.size === 0}
                  className="w-full bg-green-500 hover:bg-green-600"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Continuar com {selectedContacts.size} contatos
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetWhatsAppDialog}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Send messages */}
          {dialogStep === 'send' && (
            <div className="space-y-4">
              {/* Anti-bloqueio Info */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-800 dark:text-amber-200 font-medium text-sm">
                    Sistema Anti-Bloqueio Ativo
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <div>• Delay: {MIN_DELAY}-{MAX_DELAY}s</div>
                  <div>• Máx: {MAX_MESSAGES_PER_HOUR}/hora</div>
                  <div>• Esta hora: {messagesThisHour}/{MAX_MESSAGES_PER_HOUR}</div>
                  <div>• Erros: {errorContacts.length}</div>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Progresso: {sentContacts.length} de {customersList.length}</span>
                  <span className="text-green-600">{sentContacts.length} enviados</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all" 
                    style={{ width: `${(sentContacts.length / customersList.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current phase and countdown */}
              {isAutoSending && countdown > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    {getPhaseText()}
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {countdown}s
                  </p>
                </div>
              )}

              {/* Paused by limit */}
              {isPaused && (
                <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="font-bold text-red-800 dark:text-red-200">Pausado por segurança</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Limite de {MAX_MESSAGES_PER_HOUR} mensagens/hora atingido
                  </p>
                  <Button 
                    onClick={resumeAutoSending}
                    className="mt-3 bg-red-500 hover:bg-red-600"
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Tentar continuar
                  </Button>
                </div>
              )}
              
              {/* Current contact */}
              {currentContactIndex < customersList.length && (
                <div className="border-2 border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                  <p className="text-sm text-muted-foreground mb-1">
                    Próximo contato ({currentContactIndex + 1}/{customersList.length}):
                  </p>
                  <p className="font-bold text-lg">{customersList[currentContactIndex]?.name || 'Sem nome'}</p>
                  <p className="text-muted-foreground font-mono">
                    +{formatPhoneInternational(customersList[currentContactIndex]?.phone || '')}
                  </p>
                </div>
              )}

              {/* Message preview */}
              {manualMessage && sentContacts.length < customersList.length && (
                <div className="bg-muted/50 rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Preview da mensagem:</p>
                  <ScrollArea className="max-h-32">
                    <p className="text-sm whitespace-pre-wrap">{manualMessage}</p>
                  </ScrollArea>
                </div>
              )}

              {/* Completed */}
              {sentContacts.length >= customersList.length && customersList.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800 dark:text-green-200">Envio concluído!</p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {sentContacts.length} mensagens enviadas
                    {errorContacts.length > 0 && ` (${errorContacts.length} erros)`}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {sentContacts.length < customersList.length && !isPaused && (
                  <Button 
                    onClick={sendViaEvolutionAPI}
                    disabled={isSendingViaAPI}
                    className="w-full bg-green-500 hover:bg-green-600 h-12"
                  >
                    {isSendingViaAPI ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enviando via Evolution...</>
                    ) : (
                      <><Play className="w-5 h-5 mr-2" />Iniciar Envio Automático ({customersList.length - sentContacts.length} restantes)</>
                    )}
                  </Button>
                )}
                
                {!isAutoSending && sentContacts.length === 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setDialogStep('select')}
                    className="w-full"
                  >
                    Voltar e editar seleção
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={resetWhatsAppDialog}
                  className="w-full"
                  disabled={isAutoSending}
                >
                  {sentContacts.length >= customersList.length ? 'Fechar' : 'Cancelar'}
                </Button>
              </div>

              {/* Warning */}
              <div className="text-xs text-muted-foreground text-center border-t pt-3 space-y-1">
                <p>🔒 Sistema anti-bloqueio: simula comportamento humano</p>
                <p>Cada contato abre em nova aba - clique "Enviar" manualmente</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
