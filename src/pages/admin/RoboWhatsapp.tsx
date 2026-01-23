import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
// ChatbotMonitoringDashboard removido - funcionalidade movida para aba Prontas
import MessageEditorButton from '@/components/admin/MessageEditorButton';
import { 
  Bot, 
  Plus, 
  Play, 
  Pause, 
  Users, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Shield,
  Zap,
  Timer,
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  Settings,
  RotateCcw,
  Trash2,
  Stethoscope,
  Activity,
  Search,
  X,
  Eye,
  Pencil,
  List,
  Calendar,
  Ban,
  MessageSquare,
  BarChart3,
  FileText,
  Copy,
  Sparkles
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';

// Modos de envio com delays anti-bloqueio
const SEND_MODES = {
  humanized: { 
    label: 'Humanizado (IA Variável)', 
    delay_min_ms: 15000, 
    delay_max_ms: 90000,
    batch_size: 1, // Envia 1 por vez para controlar delay no frontend
    icon: Bot,
    description: '15-90s aleatório (Sem padrão repetitivo)',
    color: 'text-blue-600'
  },
  secure: { 
    label: 'Seguro (Recomendado)', 
    delay_min_ms: 40000, 
    delay_max_ms: 90000,
    batch_size: 15,
    icon: Shield,
    description: '40-90s entre mensagens (~30-40/hora)',
    color: 'text-green-600'
  },
  moderate: { 
    label: 'Moderado', 
    delay_min_ms: 20000, 
    delay_max_ms: 50000,
    batch_size: 20,
    icon: Timer,
    description: '20-50s entre mensagens (~50-60/hora)',
    color: 'text-yellow-600'
  },
  fast: { 
    label: 'Rápido (Arriscado)', 
    delay_min_ms: 10000, 
    delay_max_ms: 30000,
    batch_size: 25,
    icon: Zap,
    description: '10-30s entre mensagens (~80-100/hora)',
    color: 'text-red-600'
  }
} as const;

type SendMode = keyof typeof SEND_MODES;

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
}

interface Recipient {
  id: string;
  phone_e164: string;
  customer_name: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  dispatch_latency_ms?: number;
  sent_content?: string;
}

interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface ConnectionStatus {
  connected: boolean;
  checking: boolean;
  instanceName?: string;
  message?: string;
}

interface DiagnosisReport {
  instanceExists: boolean;
  connectionState: string;
  apiReachable: boolean;
  evolutionVersion?: string;
  lastQrAttempt?: unknown;
  recommendations: string[];
}

interface EligibleCustomer {
  phone: string;
  phone_e164: string;
  name: string | null;
  accepts_promo: boolean;
  lgpd_consent: boolean;
}

interface WaTemplate {
  id: string;
  name: string;
  body: string;
  category: string | null;
  status: string | null;
  footer: string | null;
  created_at: string;
  updated_at: string;
}

// Normaliza telefone para E.164 (Brasil) - retorna string vazia se inválido
function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // Já tem código do país (55) + 12-13 dígitos
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  
  // Celular brasileiro válido: 11 dígitos (DDD + 9 + 8 dígitos)
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    // DDD válido (11-99) e começa com 9
    if (ddd >= 11 && ddd <= 99 && digits[2] === '9') {
      return '55' + digits;
    }
  }
  
  // Fixo brasileiro: 10 dígitos (DDD + 8 dígitos) - menos comum para WhatsApp
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) {
      return '55' + digits;
    }
  }
  
  // Número inválido - retorna vazio para filtrar
  return '';
}

// Verifica se número E.164 é válido para WhatsApp Brasil
function isValidBrazilianPhone(phoneE164: string): boolean {
  if (!phoneE164 || phoneE164.length < 12) return false;
  if (!phoneE164.startsWith('55')) return false;
  const ddd = parseInt(phoneE164.slice(2, 4), 10);
  if (ddd < 11 || ddd > 99) return false;
  // Celular: 13 dígitos (55 + DDD + 9 + 8)
  // Fixo: 12 dígitos (55 + DDD + 8)
  return phoneE164.length === 12 || phoneE164.length === 13;
}

// Resolver Spintax: {Olá|Oi|Ei} -> Olá
function resolveSpintax(text: string): string {
  if (!text) return "";
  return text.replace(/\{([^{}]+)\}/g, (match, content) => {
    const choices = content.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

export default function RoboWhatsapp() {
  const { toast } = useToast();
  
  // Estados de autenticação por PIN
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const ROBO_PIN = '1234'; // PIN fixo - pode ser movido para settings
  
  // Estados para criar campanha
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Estados para campanhas
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [stats, setStats] = useState<CampaignStats>({ total: 0, pending: 0, sent: 0, failed: 0, skipped: 0 });
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>('humanized');
  const [testingConnection, setTestingConnection] = useState(false);
  const [generatingVariations, setGeneratingVariations] = useState(false);
  const [previewVariations, setPreviewVariations] = useState<string[]>([]);
  
  // Atualizar preview de variações quando a mensagem muda
  useEffect(() => {
    // Verifica se tem spintax
    if (campaignMessage.match(/\{([^{}]+)\}/g)) {
      const examples = Array.from({ length: 4 }).map(() => resolveSpintax(campaignMessage));
      setPreviewVariations(examples);
    } else {
      setPreviewVariations([]);
    }
  }, [campaignMessage]);
  
  // Estados para gerar fila
  const [generating, setGenerating] = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  
  // Estados para seleção individual de clientes
  const [eligibleCustomers, setEligibleCustomers] = useState<EligibleCustomer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Estados para conexão WhatsApp
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false, checking: true });
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrProgress, setQrProgress] = useState<{ attempt: number; maxAttempts: number; state?: string } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [creatingInstance, setCreatingInstance] = useState(false);
  
  // Estados para ferramentas de recuperação
  const [restartingInstance, setRestartingInstance] = useState(false);
  const [resettingSession, setResettingSession] = useState(false);
  const [recreatingInstance, setRecreatingInstance] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisReport | null>(null);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);

  // Estados para gerenciamento de campanhas (ver, editar, excluir)
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState({ name: '', message: '', scheduled_for: '' });
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [deletingCampaignLoading, setDeletingCampaignLoading] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState('');

  // Estados para teste de envio
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [useCampaignMessage, setUseCampaignMessage] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);

  // Estados para cancelar disparo
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  // Estado para auto-continuação do disparo
  const [autoDispatchActive, setAutoDispatchActive] = useState(false);
  const autoDispatchRef = useRef<NodeJS.Timeout | null>(null);
  const lastDispatchTime = useRef<Date | null>(null);

  // Estados para modal de seleção de destinatários
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedRecipientsForDispatch, setSelectedRecipientsForDispatch] = useState<Set<string>>(new Set());
  const [dispatchSearch, setDispatchSearch] = useState('');

  // Estados para modal "Adicionar e Disparar"
  const [showAddAndDispatchModal, setShowAddAndDispatchModal] = useState(false);
  const [selectedForQuickDispatch, setSelectedForQuickDispatch] = useState<Set<string>>(new Set());
  const [quickDispatchSearch, setQuickDispatchSearch] = useState('');

  // Estados para templates
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<WaTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', body: '', category: 'MARKETING', footer: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [deletingTemplateLoading, setDeletingTemplateLoading] = useState(false);
  
  // Estado para chave da API OpenAI
  const [openAiApiKey, setOpenAiApiKey] = useState('');

  // Carregar chave salva ao iniciar
  useEffect(() => {
    const savedKey = localStorage.getItem('posto7_openai_key');
    if (savedKey) setOpenAiApiKey(savedKey);
  }, []);

  // Salvar chave
  const handleSaveApiKey = () => {
    localStorage.setItem('posto7_openai_key', openAiApiKey);
    toast({ title: 'Chave API salva!', description: 'Sua chave OpenAI foi salva no navegador.' });
  };
  
  // Função de autenticação
  const handlePinSubmit = () => {
    if (pin === ROBO_PIN) {
      setIsAuthenticated(true);
      setPinError('');
      toast({ title: 'Acesso liberado!', description: 'Bem-vindo ao Robô WhatsApp.' });
    } else {
      setPinError('PIN incorreto');
      setPin('');
    }
  };
  


  // Verificar status da conexão
  const checkConnectionStatus = async () => {
    setConnectionStatus(prev => ({ ...prev, checking: true }));
    try {
      const { data, error } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'status' }
      });

      if (error) throw error;

      setConnectionStatus({
        connected: data?.connected || false,
        checking: false,
        instanceName: data?.instanceName,
        message: data?.message
      });
    } catch (error: any) {
      console.error('Erro ao verificar conexão:', error);
      setConnectionStatus({
        connected: false,
        checking: false,
        message: error.message || 'Erro ao verificar conexão'
      });
    }
  };

  // Criar instância
  const handleCreateInstance = async () => {
    setCreatingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'create' }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Instância criada!', description: data.message });
        await checkConnectionStatus();
      } else {
        throw new Error(data?.error || 'Erro ao criar instância');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setCreatingInstance(false);
    }
  };

  // Reiniciar instância
  const handleRestartInstance = async () => {
    setRestartingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'restart' }
      });

      if (error) throw error;

      toast({ title: 'Instância reiniciada!', description: data?.message || 'Aguarde alguns segundos.' });
      await new Promise(r => setTimeout(r, 3000));
      await checkConnectionStatus();
    } catch (error: any) {
      toast({ title: 'Erro ao reiniciar', description: error.message, variant: 'destructive' });
    } finally {
      setRestartingInstance(false);
    }
  };

  // Resetar sessão (logout + restart)
  const handleResetSession = async () => {
    setResettingSession(true);
    try {
      // First logout
      await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'logout' }
      });
      
      // Wait a bit
      await new Promise(r => setTimeout(r, 2000));
      
      // Then restart
      await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'restart' }
      });

      toast({ title: 'Sessão resetada!', description: 'Aguarde alguns segundos e tente conectar novamente.' });
      await new Promise(r => setTimeout(r, 3000));
      await checkConnectionStatus();
    } catch (error: any) {
      toast({ title: 'Erro ao resetar sessão', description: error.message, variant: 'destructive' });
    } finally {
      setResettingSession(false);
    }
  };

  // Recriar instância (delete + create)
  const handleRecreateInstance = async () => {
    setRecreatingInstance(true);
    try {
      // Delete
      await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'delete' }
      });
      
      // Wait
      await new Promise(r => setTimeout(r, 2000));
      
      // Create
      const { data, error } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'create' }
      });

      if (error) throw error;

      toast({ title: 'Instância recriada!', description: data?.message || 'Agora gere o QR Code.' });
      await checkConnectionStatus();
    } catch (error: any) {
      toast({ title: 'Erro ao recriar', description: error.message, variant: 'destructive' });
    } finally {
      setRecreatingInstance(false);
    }
  };

  // Diagnóstico
  const handleDiagnose = async () => {
    setDiagnosing(true);
    setDiagnosis(null);
    try {
      const { data, error } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'diagnose' }
      });

      if (error) throw error;

      if (data?.diagnosis) {
        setDiagnosis(data.diagnosis);
        setShowDiagnosisModal(true);
      } else {
        throw new Error('Diagnóstico não retornado');
      }
    } catch (error: any) {
      toast({ title: 'Erro no diagnóstico', description: error.message, variant: 'destructive' });
    } finally {
      setDiagnosing(false);
    }
  };

  // Gerar QR Code
  const handleGenerateQR = async () => {
    setQrLoading(true);
    setQrCode(null);
    setQrCodeText(null);
    setPairingCode(null);
    setQrProgress(null);
    setQrError(null);
    setQrModalOpen(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'qrcode' }
      });

      if (error) throw error;

      if (data?.progress) {
        setQrProgress(data.progress);
      }

      if (data?.connected) {
        toast({ title: 'WhatsApp já conectado!' });
        setQrModalOpen(false);
        await checkConnectionStatus();
      } else if (data?.qrcode) {
        // Base64 image format
        setQrCode(data.qrcode);
      } else if (data?.qrcodeText) {
        // Text format - render via qrcode.react
        setQrCodeText(data.qrcodeText);
        if (data?.pairingCode) {
          setPairingCode(data.pairingCode);
        }
      } else if (data?.pairingCode) {
        // Pairing code only
        setPairingCode(data.pairingCode);
      } else if (data?.error) {
        setQrError(data.message || data.error);
        throw new Error(data.error);
      } else {
        setQrError('QR Code não retornado após várias tentativas');
        throw new Error('QR Code não retornado');
      }
    } catch (error: any) {
      setQrError(error.message);
      // Don't close modal, show error with recovery options
    } finally {
      setQrLoading(false);
    }
  };

  // Auto-refresh do status quando modal está aberto
  useEffect(() => {
    if (!qrModalOpen) return;

    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke('wa-instance-manage', {
        body: { action: 'status' }
      });

      if (data?.connected) {
        toast({ title: 'WhatsApp conectado com sucesso!' });
        setQrModalOpen(false);
        setConnectionStatus({
          connected: true,
          checking: false,
          instanceName: data?.instanceName,
          message: 'Conectado'
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [qrModalOpen]);

  // Subscription realtime para atualizações de campanhas
  useEffect(() => {
    const channel = supabase
      .channel('campaign-status-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_campaigns' },
        (payload) => {
          // Atualizar campanha selecionada se for a mesma
          if (selectedCampaign?.id === payload.new.id) {
            setSelectedCampaign(prev => prev ? { ...prev, status: payload.new.status as string } : null);
          }
          // Recarregar lista de campanhas
          loadCampaigns();
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [selectedCampaign?.id]);

  // Auto-refresh dos recipients enquanto campanha está enviando
  useEffect(() => {
    if (selectedCampaign?.status !== 'sending') return;

    const interval = setInterval(() => {
      loadRecipients(selectedCampaign.id);
    }, 5000); // A cada 5 segundos

    return () => clearInterval(interval);
  }, [selectedCampaign?.id, selectedCampaign?.status]);

  // Carregar campanhas
  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar campanhas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Carregar recipients de uma campanha
  const loadRecipients = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setRecipients(data || []);
      
      // Calcular stats
      const newStats: CampaignStats = { total: 0, pending: 0, sent: 0, failed: 0, skipped: 0 };
      (data || []).forEach((r: Recipient) => {
        newStats.total++;
        if (r.status === 'pending') newStats.pending++;
        else if (r.status === 'sent') newStats.sent++;
        else if (r.status === 'failed') newStats.failed++;
        else if (r.status === 'skipped') newStats.skipped++;
      });
      setStats(newStats);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar destinatários', description: error.message, variant: 'destructive' });
    }
  };

  // Carregar templates
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('wa_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar templates', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Salvar template (criar ou editar)
  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.body.trim()) {
      toast({ title: 'Preencha nome e mensagem', variant: 'destructive' });
      return;
    }

    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        // Editar existente
        const { error } = await supabase
          .from('wa_templates')
          .update({
            name: templateForm.name.trim(),
            body: templateForm.body.trim(),
            category: templateForm.category,
            footer: templateForm.footer.trim() || null
          })
          .eq('id', editingTemplate.id);
        
        if (error) throw error;
        toast({ title: 'Template atualizado!' });
      } else {
        // Criar novo
        const { error } = await supabase
          .from('wa_templates')
          .insert({
            name: templateForm.name.trim(),
            body: templateForm.body.trim(),
            category: templateForm.category,
            footer: templateForm.footer.trim() || null,
            status: 'approved'
          });
        
        if (error) throw error;
        toast({ title: 'Template criado!' });
      }
      
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', body: '', category: 'MARKETING', footer: '' });
      loadTemplates();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar template', description: error.message, variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Excluir template
  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;

    setDeletingTemplateLoading(true);
    try {
      const { error } = await supabase
        .from('wa_templates')
        .delete()
        .eq('id', deletingTemplate.id);

      if (error) throw error;

      toast({ title: 'Template excluído!' });
      setDeletingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingTemplateLoading(false);
    }
  };

  // Usar template em campanha
  const handleUseTemplate = (template: WaTemplate) => {
    setCampaignMessage(template.body);
    toast({ title: 'Mensagem copiada!', description: 'Vá para a aba "Criar" para usar na campanha.' });
  };

  // Abrir modal de edição de template
  const handleOpenEditTemplate = (template: WaTemplate) => {
    setTemplateForm({
      name: template.name,
      body: template.body,
      category: template.category || 'MARKETING',
      footer: template.footer || ''
    });
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  // Abrir modal de novo template
  const handleOpenNewTemplate = () => {
    setTemplateForm({ name: '', body: '', category: 'MARKETING', footer: '' });
    setEditingTemplate(null);
    setShowTemplateModal(true);
  };

  // Templates filtrados
  const filteredTemplates = templates.filter(t => {
    if (!templateSearch) return true;
    const search = templateSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(search) ||
      t.body.toLowerCase().includes(search) ||
      (t.category && t.category.toLowerCase().includes(search))
    );
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadCampaigns();
      checkConnectionStatus();
      loadTemplates();
    }
  }, [isAuthenticated]);

  // Auto-continuação do disparo - chama a Edge Function em lotes pequenos
  const continueDispatch = useCallback(async () => {
    if (!selectedCampaign || selectedCampaign.status !== 'sending') {
      setAutoDispatchActive(false);
      return;
    }
    
    // Recarregar stats para verificar pendentes
    const { data: freshRecipients } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('status')
      .eq('campaign_id', selectedCampaign.id);
    
    const freshStats = {
      total: freshRecipients?.length || 0,
      pending: freshRecipients?.filter(r => r.status === 'pending').length || 0,
      sent: freshRecipients?.filter(r => r.status === 'sent').length || 0,
      failed: freshRecipients?.filter(r => r.status === 'failed').length || 0,
      skipped: freshRecipients?.filter(r => r.status === 'skipped').length || 0
    };
    
    setStats(freshStats);
    
    if (freshStats.pending === 0) {
      console.log('[AutoDispatch] No pending recipients, stopping');
      setAutoDispatchActive(false);
      toast({ title: 'Disparo concluído!', description: `${freshStats.sent} mensagens enviadas` });
      loadCampaigns(); // Recarregar para atualizar status
      return;
    }
    
    console.log(`[AutoDispatch] Sending next batch (${freshStats.pending} pending)`);
    lastDispatchTime.current = new Date();
    
    try {
      const mode = SEND_MODES[sendMode];
      const { data, error } = await supabase.functions.invoke('wa-campaign-run', {
        body: { 
          campaign_id: selectedCampaign.id,
          batch_size: mode.batch_size,
          delay_min_ms: mode.delay_min_ms,
          delay_max_ms: mode.delay_max_ms
        }
      });
      
      if (error) {
        console.error('[AutoDispatch] Error:', error);
        // Não para automaticamente - tenta novamente no próximo ciclo
      } else {
        console.log('[AutoDispatch] Batch result:', data);
        // Recarregar recipients para atualizar stats
        await loadRecipients(selectedCampaign.id);
      }
    } catch (err) {
      console.error('[AutoDispatch] Exception:', err);
    }
  }, [selectedCampaign, sendMode, toast]);

  // Effect para auto-continuação do disparo (Loop recursivo variável)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runLoop = async () => {
      // Verificar condições de parada antes de executar
      // Precisamos verificar o ref ou estado mais atual se possível, mas aqui dependemos do closure
      // Se o status mudar, o effect desmonta e limpa o timeout, então ok.
      
      await continueDispatch();
      
      // Calcular próximo delay com base no modo
      const mode = SEND_MODES[sendMode];
      let nextDelay = 20000; // Fallback seguro

      if (mode.batch_size === 1) {
        // Modo Humanizado: Backend envia 1 e retorna. O delay deve ser feito AQUI no frontend.
        // Delay aleatório entre 15s e 90s (ou o que estiver no modo)
        nextDelay = Math.floor(Math.random() * (mode.delay_max_ms - mode.delay_min_ms + 1)) + mode.delay_min_ms;
        console.log(`[AutoDispatch] Humanized delay: Waiting ${Math.round(nextDelay/1000)}s before next message...`);
      } else {
        // Modos em Lote: Backend faz o delay entre mensagens.
        // Aqui esperamos apenas um buffer para não sobrecarregar a Edge Function
        nextDelay = 5000; 
      }

      // Agendar próxima execução se ainda estiver ativo
      // Nota: O cleanup do useEffect cancelará isso se o componente desmontar ou deps mudarem
      timeoutId = setTimeout(runLoop, nextDelay);
    };

    // Iniciar loop se ativo e enviando
    if (autoDispatchActive && selectedCampaign?.status === 'sending') {
      console.log('[AutoDispatch] Starting variable delay loop');
      runLoop();
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [autoDispatchActive, selectedCampaign?.status, sendMode, continueDispatch]);

  // Parar auto-dispatch quando campanha não está mais em sending
  useEffect(() => {
    if (selectedCampaign?.status !== 'sending') {
      setAutoDispatchActive(false);
    }
  }, [selectedCampaign?.status]);

  useEffect(() => {
    if (selectedCampaign) {
      loadRecipients(selectedCampaign.id);
      loadEligibleCustomers(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  // Carregar clientes elegíveis para seleção individual
  const loadEligibleCustomers = async (campaignId: string) => {
    setLoadingCustomers(true);
    setSelectedCustomers(new Set());
    try {
      // Buscar clientes - com ou sem filtro de opt-in
      let query = supabase
        .from('customers')
        .select('phone, name, accepts_promo, lgpd_consent');
      
      // Se não mostrar todos, filtrar apenas com opt-in
      if (!showAllCustomers) {
        query = query.eq('accepts_promo', true).eq('lgpd_consent', true);
      }
      
      const { data: customers, error: customersError } = await query;
      
      if (customersError) throw customersError;

      // Buscar opt-outs
      const { data: optouts } = await supabase
        .from('whatsapp_optout')
        .select('phone_e164');
      
      const optoutSet = new Set((optouts || []).map(o => o.phone_e164));

      // Buscar recipients já existentes nesta campanha
      const { data: existingRecipients } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('phone_e164')
        .eq('campaign_id', campaignId);
      
      const existingSet = new Set((existingRecipients || []).map(r => r.phone_e164));

      // Normalizar e filtrar - usando validação robusta
      const eligible: EligibleCustomer[] = [];
      const seenPhones = new Set<string>();
      
      (customers || []).forEach(c => {
        const normalized = normalizePhoneE164(c.phone);
        // Usar validação robusta ao invés de apenas comprimento
        if (
          isValidBrazilianPhone(normalized) && 
          !optoutSet.has(normalized) && 
          !existingSet.has(normalized) &&
          !seenPhones.has(normalized)
        ) {
          seenPhones.add(normalized);
          eligible.push({
            phone: c.phone,
            phone_e164: normalized,
            name: c.name,
            accepts_promo: c.accepts_promo ?? false,
            lgpd_consent: c.lgpd_consent ?? false
          });
        }
      });

      setEligibleCustomers(eligible);
    } catch (error: any) {
      console.error('Erro ao carregar clientes elegíveis:', error);
      toast({ title: 'Erro ao carregar clientes', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Toggle seleção de cliente
  const toggleCustomerSelection = (phoneE164: string) => {
    setSelectedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phoneE164)) {
        newSet.delete(phoneE164);
      } else {
        newSet.add(phoneE164);
      }
      return newSet;
    });
  };

  // Selecionar/desselecionar todos (filtrados)
  const toggleSelectAll = () => {
    const filtered = filteredEligibleCustomers;
    if (selectedCustomers.size === filtered.length && filtered.length > 0) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filtered.map(c => c.phone_e164)));
    }
  };

  // Clientes filtrados por busca
  const filteredEligibleCustomers = eligibleCustomers.filter(c => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    return (
      c.phone_e164.includes(search) ||
      c.phone.includes(search) ||
      (c.name && c.name.toLowerCase().includes(search))
    );
  });

  // Gerar variações com IA
  const handleGenerateVariations = async () => {
    if (!campaignMessage.trim()) {
      toast({ title: 'Digite uma mensagem base primeiro', variant: 'destructive' });
      return;
    }

    setGeneratingVariations(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-variations', {
        body: { 
          message: campaignMessage,
          apiKey: openAiApiKey
        }
      });

      if (error) throw error;

      if (data?.spintax) {
        setCampaignMessage(data.spintax);
        toast({ 
          title: 'Variações geradas com sucesso!', 
          description: 'Sua mensagem agora usa formato Spintax para variar o conteúdo.' 
        });
      } else {
        throw new Error('Falha ao gerar variações');
      }
    } catch (error: any) {
      console.error('Erro ao gerar variações:', error);
      let errorMessage = error.message;
      if (error.message.includes('Failed to send a request') || error.message.includes('ERR_FAILED')) {
        errorMessage = 'Erro de conexão com a função de IA. A função ainda não foi deployada ou configurada corretamente no Supabase.';
      }
      toast({ title: 'Erro ao gerar variações', description: errorMessage, variant: 'destructive' });
    } finally {
      setGeneratingVariations(false);
    }
  };

  // Criar campanha
  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !campaignMessage.trim()) {
      toast({ title: 'Preencha nome e mensagem', variant: 'destructive' });
      return;
    }

    // Adicionar rodapé obrigatório se não existir
    let finalMessage = campaignMessage;
    if (!finalMessage.includes('SAIR')) {
      finalMessage += '\n\nPara parar de receber, responda SAIR.';
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .insert({
          name: campaignName.trim(),
          message: finalMessage,
          scheduled_for: scheduledFor || null,
          created_by: user?.id,
          status: 'draft'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({ title: 'Campanha criada com sucesso!' });
      setCampaignName('');
      setCampaignMessage('');
      setScheduledFor('');
      loadCampaigns();
      setSelectedCampaign(data);
    } catch (error: any) {
      toast({ title: 'Erro ao criar campanha', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Gerar fila a partir de clientes selecionados (ou todos se nenhum selecionado)
  const handleGenerateQueue = async (addAll = false) => {
    if (!selectedCampaign) {
      toast({ title: 'Selecione uma campanha primeiro', variant: 'destructive' });
      return;
    }

    // Se não quer adicionar todos e não tem seleção
    if (!addAll && selectedCustomers.size === 0) {
      toast({ title: 'Selecione ao menos um cliente ou clique em "Adicionar Todos"', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    setQueueCount(null);
    try {
      // Determinar quais clientes adicionar
      const customersToAdd = addAll 
        ? eligibleCustomers 
        : eligibleCustomers.filter(c => selectedCustomers.has(c.phone_e164));

      if (customersToAdd.length === 0) {
        toast({ title: 'Nenhum cliente para adicionar', variant: 'default' });
        setGenerating(false);
        return;
      }

      // Inserir recipients
      const recipientsToInsert = customersToAdd.map(c => ({
        campaign_id: selectedCampaign.id,
        phone_e164: c.phone_e164,
        customer_name: c.name,
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('whatsapp_campaign_recipients')
        .insert(recipientsToInsert);
      
      if (insertError) throw insertError;

      setQueueCount(recipientsToInsert.length);
      toast({ title: `${recipientsToInsert.length} contato(s) adicionado(s) à fila!` });
      
      // Limpar seleção e recarregar dados
      setSelectedCustomers(new Set());
      loadRecipients(selectedCampaign.id);
      loadEligibleCustomers(selectedCampaign.id);
    } catch (error: any) {
      toast({ title: 'Erro ao gerar fila', description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Testar conexão
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-campaign-run', {
        body: { 
          campaign_id: 'test',
          test_only: true
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Conexão OK!', description: 'WhatsApp conectado e pronto para enviar.' });
        setConnectionStatus({ connected: true, checking: false });
      } else {
        throw new Error(data?.message || 'Falha na conexão');
      }
    } catch (error: any) {
      toast({ 
        title: 'Falha na conexão', 
        description: error.message || 'Verifique as configurações da Evolution API',
        variant: 'destructive' 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Abrir modal de seleção de destinatários
  const handleOpenDispatchModal = () => {
    if (!selectedCampaign) return;
    
    if (stats.pending === 0) {
      toast({ title: 'Fila vazia! Gere a fila primeiro.', variant: 'destructive' });
      return;
    }

    if (selectedCampaign.status === 'sending') {
      toast({ title: 'Esta campanha já está em disparo!', variant: 'destructive' });
      return;
    }

    if (!connectionStatus.connected) {
      toast({ title: 'WhatsApp não conectado!', description: 'Conecte o WhatsApp primeiro.', variant: 'destructive' });
      return;
    }

    // Limpar seleção anterior e abrir modal
    setSelectedRecipientsForDispatch(new Set());
    setDispatchSearch('');
    setShowDispatchModal(true);
  };

  // Toggle individual de recipient para disparo
  const toggleRecipientForDispatch = (recipientId: string) => {
    setSelectedRecipientsForDispatch(prev => {
      const next = new Set(prev);
      if (next.has(recipientId)) {
        next.delete(recipientId);
      } else {
        next.add(recipientId);
      }
      return next;
    });
  };

  // Toggle todos os pendentes para disparo
  const toggleAllRecipientsForDispatch = () => {
    const pendingRecipients = recipients.filter(r => r.status === 'pending');
    const filteredPending = dispatchSearch
      ? pendingRecipients.filter(r => 
          r.phone_e164.includes(dispatchSearch) || 
          r.customer_name?.toLowerCase().includes(dispatchSearch.toLowerCase())
        )
      : pendingRecipients;
    
    const allSelected = filteredPending.every(r => selectedRecipientsForDispatch.has(r.id));
    
    if (allSelected) {
      // Desmarcar todos
      const next = new Set(selectedRecipientsForDispatch);
      filteredPending.forEach(r => next.delete(r.id));
      setSelectedRecipientsForDispatch(next);
    } else {
      // Marcar todos
      const next = new Set(selectedRecipientsForDispatch);
      filteredPending.forEach(r => next.add(r.id));
      setSelectedRecipientsForDispatch(next);
    }
  };

  // Toggle individual para "Adicionar e Disparar"
  const toggleQuickDispatchSelection = (phoneE164: string) => {
    setSelectedForQuickDispatch(prev => {
      const next = new Set(prev);
      if (next.has(phoneE164)) {
        next.delete(phoneE164);
      } else {
        next.add(phoneE164);
      }
      return next;
    });
  };

  // Toggle todos para "Adicionar e Disparar"
  const toggleAllQuickDispatch = () => {
    const filtered = eligibleCustomers.filter(c => {
      if (!quickDispatchSearch) return true;
      const search = quickDispatchSearch.toLowerCase();
      return (
        c.phone_e164.includes(search) ||
        c.phone.includes(search) ||
        (c.name && c.name.toLowerCase().includes(search))
      );
    });
    
    const allSelected = filtered.length > 0 && filtered.every(c => selectedForQuickDispatch.has(c.phone_e164));
    
    if (allSelected) {
      setSelectedForQuickDispatch(new Set());
    } else {
      setSelectedForQuickDispatch(new Set(filtered.map(c => c.phone_e164)));
    }
  };

  // Abrir modal "Adicionar e Disparar"
  const handleOpenAddAndDispatch = () => {
    if (!selectedCampaign) {
      toast({ title: 'Selecione uma campanha primeiro', variant: 'destructive' });
      return;
    }

    if (!connectionStatus.connected) {
      toast({ title: 'WhatsApp não conectado!', description: 'Conecte o WhatsApp primeiro.', variant: 'destructive' });
      return;
    }

    // Recarregar clientes e abrir modal
    loadEligibleCustomers(selectedCampaign.id);
    setSelectedForQuickDispatch(new Set());
    setQuickDispatchSearch('');
    setShowAddAndDispatchModal(true);
  };

  // Adicionar e Disparar em um só passo
  const handleAddAndDispatch = async () => {
    if (!selectedCampaign) return;
    
    if (selectedForQuickDispatch.size === 0) {
      toast({ title: 'Selecione ao menos um cliente', variant: 'destructive' });
      return;
    }

    setDispatching(true);
    try {
      // 1. Filtrar clientes selecionados
      const customersToAdd = eligibleCustomers.filter(c => 
        selectedForQuickDispatch.has(c.phone_e164)
      );

      if (customersToAdd.length === 0) {
        toast({ title: 'Nenhum cliente selecionado', variant: 'destructive' });
        setDispatching(false);
        return;
      }

      // 2. Inserir na fila de recipients
      const recipientsToInsert = customersToAdd.map(c => ({
        campaign_id: selectedCampaign.id,
        phone_e164: c.phone_e164,
        customer_name: c.name,
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('whatsapp_campaign_recipients')
        .insert(recipientsToInsert);

      if (insertError) throw insertError;

      // 3. Atualizar status da campanha para sending
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'sending' })
        .eq('id', selectedCampaign.id);

      // 4. IMPORTANTE: Atualizar estado local imediatamente para mostrar barra de progresso
      setSelectedCampaign({ ...selectedCampaign, status: 'sending' });

      // 5. Disparar primeiro lote (sem recipient_ids - Edge Function busca pendentes)
      const { error: dispatchError } = await supabase.functions.invoke('wa-campaign-run', {
        body: { 
          campaign_id: selectedCampaign.id,
          batch_size: 5, // Lote pequeno para não dar timeout
          delay_min_ms: 8000,
          delay_max_ms: 15000
        }
      });

      if (dispatchError) {
        console.error('[handleAddAndDispatch] Dispatch error:', dispatchError);
        // Não reverte - auto-dispatch vai continuar tentando
      }

      const estimatedMinutes = Math.ceil((recipientsToInsert.length * 12) / 60);

      toast({ 
        title: `Disparo iniciado para ${recipientsToInsert.length} contato(s)!`,
        description: `Tempo estimado: ~${estimatedMinutes} min. Auto-continuação ativada.`
      });
      
      setShowAddAndDispatchModal(false);
      loadRecipients(selectedCampaign.id);
      loadEligibleCustomers(selectedCampaign.id);
      loadCampaigns();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      
      // Reverter status em caso de erro
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'draft' })
        .eq('id', selectedCampaign.id);
      setSelectedCampaign({ ...selectedCampaign, status: 'draft' });
    } finally {
      setDispatching(false);
    }
  };

  // Disparar campanha com IDs selecionados
  const handleConfirmDispatch = async () => {
    if (!selectedCampaign) return;
    
    if (selectedRecipientsForDispatch.size === 0) {
      toast({ title: 'Selecione ao menos um destinatário', variant: 'destructive' });
      return;
    }

    const estimatedMinutes = Math.ceil((selectedRecipientsForDispatch.size * 12) / 60);

    setShowDispatchModal(false);
    setDispatching(true);
    try {
      // Atualizar status para sending
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'sending' })
        .eq('id', selectedCampaign.id);

      // IMPORTANTE: Atualizar estado local imediatamente para mostrar barra de progresso
      setSelectedCampaign({ ...selectedCampaign, status: 'sending' });

      // Chamar edge function SEM recipient_ids - deixa buscar pendentes automaticamente
      const { error } = await supabase.functions.invoke('wa-campaign-run', {
        body: { 
          campaign_id: selectedCampaign.id,
          batch_size: 5, // Lote pequeno para não dar timeout
          delay_min_ms: 8000,
          delay_max_ms: 15000
        }
      });

      if (error) {
        console.error('[handleConfirmDispatch] Dispatch error:', error);
        // Não reverte - auto-dispatch vai continuar tentando
      }

      toast({ 
        title: 'Disparo iniciado!', 
        description: `Enviando para ${selectedRecipientsForDispatch.size} contatos. Tempo estimado: ~${estimatedMinutes} min. Auto-continuação ativada.` 
      });
      
      loadCampaigns();
      loadRecipients(selectedCampaign.id);
    } catch (error: any) {
      toast({ title: 'Erro ao disparar', description: error.message, variant: 'destructive' });
      
      // Reverter status em caso de erro
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'draft' })
        .eq('id', selectedCampaign.id);
      setSelectedCampaign({ ...selectedCampaign, status: 'draft' });
    } finally {
      setDispatching(false);
    }
  };

  // Pausar campanha
  const handlePause = async () => {
    if (!selectedCampaign) return;
    
    try {
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'paused' })
        .eq('id', selectedCampaign.id);
      
      toast({ title: 'Campanha pausada' });
      loadCampaigns();
      setSelectedCampaign({ ...selectedCampaign, status: 'paused' });
    } catch (error: any) {
      toast({ title: 'Erro ao pausar', description: error.message, variant: 'destructive' });
    }
  };

  // Retomar campanha
  const handleResume = async () => {
    if (!selectedCampaign) return;
    
    try {
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'sending' })
        .eq('id', selectedCampaign.id);
      
      toast({ title: 'Campanha retomada' });
      loadCampaigns();
      setSelectedCampaign({ ...selectedCampaign, status: 'sending' });
    } catch (error: any) {
      toast({ title: 'Erro ao retomar', description: error.message, variant: 'destructive' });
    }
  };

  // Parar disparo (apenas pausa, não marca pendentes como skipped)
  const handleStopDispatch = async () => {
    if (!selectedCampaign) return;
    
    setCancelling(true);
    try {
      // Apenas pausar a campanha - NÃO marca pendentes como skipped
      const { error: campaignError } = await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'paused' })
        .eq('id', selectedCampaign.id);
      
      if (campaignError) throw campaignError;

      toast({ 
        title: 'Disparo parado', 
        description: 'Os contatos pendentes continuam disponíveis para envio posterior.' 
      });
      
      loadCampaigns();
      loadRecipients(selectedCampaign.id);
      setSelectedCampaign({ ...selectedCampaign, status: 'paused' });
    } catch (error: any) {
      toast({ title: 'Erro ao parar', description: error.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  // Continuar disparo (abre modal para selecionar pendentes)
  const handleContinueDispatch = () => {
    if (!selectedCampaign || stats.pending === 0) return;
    
    // Seleciona automaticamente todos os pendentes
    const pendingIds = new Set(
      recipients.filter(r => r.status === 'pending').map(r => r.id)
    );
    setSelectedRecipientsForDispatch(pendingIds);
    setShowDispatchModal(true);
  };

  // Enviar teste
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast({ title: 'Digite um número de teste', variant: 'destructive' });
      return;
    }

    const messageToSend = useCampaignMessage && selectedCampaign 
      ? selectedCampaign.message.replace(/\{\{nome\}\}/gi, 'Teste')
      : testMessage;

    if (!messageToSend.trim()) {
      toast({ title: 'Digite uma mensagem ou selecione uma campanha', variant: 'destructive' });
      return;
    }

    setSendingTest(true);
    
    try {
      const normalizedPhone = normalizePhoneE164(testPhone.trim());
      
      const { data, error } = await supabase.functions.invoke('wa-send', {
        body: { 
          phone: normalizedPhone,
          message: messageToSend.trim()
        }
      });

      if (error) throw error;

      if (data?.success) {
        setLastTestResult({
          success: true,
          message: `Mensagem enviada para ${normalizedPhone}`,
          timestamp: new Date()
        });
        toast({ title: '✅ Teste enviado!', description: 'Verifique seu WhatsApp' });
      } else {
        throw new Error(data?.error || data?.message || 'Falha no envio');
      }
    } catch (error: any) {
      setLastTestResult({
        success: false,
        message: error.message,
        timestamp: new Date()
      });
      toast({ title: '❌ Falha no teste', description: error.message, variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Rascunho</Badge>;
      case 'sending': return <Badge className="bg-blue-500">Enviando</Badge>;
      case 'paused': return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Pausado</Badge>;
      case 'done': return <Badge className="bg-green-500">Concluído</Badge>;
      case 'cancelled': return <Badge variant="outline" className="border-red-500 text-red-500">Cancelado</Badge>;
      case 'pending': return <Badge variant="secondary">Pendente</Badge>;
      case 'sent': return <Badge className="bg-green-500">Enviado</Badge>;
      case 'failed': return <Badge variant="destructive">Falhou</Badge>;
      case 'skipped': return <Badge variant="outline">Ignorado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  // Funções para gerenciar campanhas (editar/excluir)
  const handleOpenEdit = (campaign: Campaign) => {
    setEditForm({
      name: campaign.name,
      message: campaign.message,
      scheduled_for: campaign.scheduled_for || ''
    });
    setEditingCampaign(campaign);
  };

  const handleSaveCampaign = async () => {
    if (!editingCampaign) return;
    if (!editForm.name.trim() || !editForm.message.trim()) {
      toast({ title: 'Preencha nome e mensagem', variant: 'destructive' });
      return;
    }

    setSavingCampaign(true);
    try {
      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update({
          name: editForm.name.trim(),
          message: editForm.message.trim(),
          scheduled_for: editForm.scheduled_for || null
        })
        .eq('id', editingCampaign.id);

      if (error) throw error;

      toast({ title: 'Campanha atualizada!' });
      setEditingCampaign(null);
      loadCampaigns();
      
      // Se a campanha editada era a selecionada, atualiza
      if (selectedCampaign?.id === editingCampaign.id) {
        setSelectedCampaign({
          ...selectedCampaign,
          name: editForm.name.trim(),
          message: editForm.message.trim(),
          scheduled_for: editForm.scheduled_for || null
        });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!deletingCampaign) return;

    setDeletingCampaignLoading(true);
    try {
      // Primeiro excluir recipients associados
      const { error: recipientsError } = await supabase
        .from('whatsapp_campaign_recipients')
        .delete()
        .eq('campaign_id', deletingCampaign.id);

      if (recipientsError) throw recipientsError;

      // Depois excluir a campanha
      const { error: campaignError } = await supabase
        .from('whatsapp_campaigns')
        .delete()
        .eq('id', deletingCampaign.id);

      if (campaignError) throw campaignError;

      toast({ title: 'Campanha excluída!' });
      setDeletingCampaign(null);
      loadCampaigns();
      
      // Se a campanha excluída era a selecionada, limpa
      if (selectedCampaign?.id === deletingCampaign.id) {
        setSelectedCampaign(null);
        setRecipients([]);
        setStats({ total: 0, pending: 0, sent: 0, failed: 0, skipped: 0 });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingCampaignLoading(false);
    }
  };

  // Campanhas filtradas por busca
  const filteredCampaigns = campaigns.filter(c => {
    if (!campaignSearch) return true;
    const search = campaignSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      c.message.toLowerCase().includes(search)
    );
  });

  // Contar recipients para uma campanha (para modal de visualização)
  const getCampaignRecipientCount = async (campaignId: string): Promise<{ total: number; pending: number; sent: number; failed: number }> => {
    const { data } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId);
    
    const counts = { total: 0, pending: 0, sent: 0, failed: 0 };
    (data || []).forEach(r => {
      counts.total++;
      if (r.status === 'pending') counts.pending++;
      else if (r.status === 'sent') counts.sent++;
      else if (r.status === 'failed') counts.failed++;
    });
    return counts;
  };

  // Tela de login se não autenticado
  if (!isAuthenticated) {
    return (
      <AdminLayout title="Robô WhatsApp">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Acesso Restrito</CardTitle>
              <CardDescription>
                Digite o PIN para acessar o Robô WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de Acesso</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="Digite o PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePinSubmit();
                  }}
                  className={pinError ? 'border-destructive' : ''}
                />
                {pinError && (
                  <p className="text-sm text-destructive">{pinError}</p>
                )}
              </div>
              <Button onClick={handlePinSubmit} className="w-full">
                <Shield className="w-4 h-4 mr-2" />
                Acessar
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const isAnyRecoveryAction = restartingInstance || resettingSession || recreatingInstance || diagnosing;

  return (
    <AdminLayout title="Robô WhatsApp">
      <div className="space-y-6">
        {/* Card de Status da Conexão */}
        <Card className={connectionStatus.connected ? 'border-green-500' : 'border-yellow-500'}>
          <CardContent className="py-4">
            <div className="flex flex-col gap-4">
              {/* Status line */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {connectionStatus.checking ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : connectionStatus.connected ? (
                    <Wifi className="w-6 h-6 text-green-500" />
                  ) : (
                    <WifiOff className="w-6 h-6 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {connectionStatus.checking 
                        ? 'Verificando conexão...' 
                        : connectionStatus.connected 
                          ? 'WhatsApp Conectado' 
                          : 'WhatsApp Desconectado'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {connectionStatus.instanceName && `Instância: ${connectionStatus.instanceName}`}
                      {connectionStatus.message && !connectionStatus.connected && ` - ${connectionStatus.message}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkConnectionStatus}
                    disabled={connectionStatus.checking}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${connectionStatus.checking ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                  {!connectionStatus.connected && !connectionStatus.checking && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCreateInstance}
                        disabled={creatingInstance}
                      >
                        {creatingInstance ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                        ) : (
                          <><Settings className="w-4 h-4 mr-2" /> Criar Instância</>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleGenerateQR}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Conectar WhatsApp
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Ferramentas de recuperação (visíveis quando desconectado) */}
              {!connectionStatus.connected && !connectionStatus.checking && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Ferramentas de Recuperação:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleRestartInstance}
                      disabled={isAnyRecoveryAction}
                    >
                      {restartingInstance ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2" />
                      )}
                      Reiniciar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetSession}
                      disabled={isAnyRecoveryAction}
                    >
                      {resettingSession ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Resetar Sessão
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleDiagnose}
                      disabled={isAnyRecoveryAction}
                    >
                      {diagnosing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Stethoscope className="w-4 h-4 mr-2" />
                      )}
                      Diagnóstico
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleRecreateInstance}
                      disabled={isAnyRecoveryAction}
                    >
                      {recreatingInstance ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Recriar Instância
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal de Diagnóstico */}
        <Dialog open={showDiagnosisModal} onOpenChange={setShowDiagnosisModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Diagnóstico da Evolution API
              </DialogTitle>
              <DialogDescription>
                Relatório completo do estado da conexão
              </DialogDescription>
            </DialogHeader>
            {diagnosis && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">API Acessível</p>
                    <p className={`font-semibold ${diagnosis.apiReachable ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnosis.apiReachable ? 'Sim ✓' : 'Não ✗'}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Instância Existe</p>
                    <p className={`font-semibold ${diagnosis.instanceExists ? 'text-green-600' : 'text-yellow-600'}`}>
                      {diagnosis.instanceExists ? 'Sim ✓' : 'Não'}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Estado da Conexão</p>
                    <p className={`font-semibold ${
                      diagnosis.connectionState === 'open' || diagnosis.connectionState === 'connected'
                        ? 'text-green-600' 
                        : diagnosis.connectionState === 'connecting' 
                          ? 'text-yellow-600' 
                          : 'text-red-600'
                    }`}>
                      {diagnosis.connectionState}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Versão Evolution</p>
                    <p className="font-semibold">{diagnosis.evolutionVersion || 'Desconhecida'}</p>
                  </div>
                </div>

                {diagnosis.recommendations.length > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      Recomendações
                    </p>
                    <ul className="space-y-1 text-sm">
                      {diagnosis.recommendations.map((rec, i) => (
                        <li key={i} className="text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagnosis.lastQrAttempt && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Última tentativa de QR (debug)</summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                      {JSON.stringify(diagnosis.lastQrAttempt, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowDiagnosisModal(false)}>
                    Fechar
                  </Button>
                  <Button onClick={handleResetSession} disabled={resettingSession}>
                    {resettingSession ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Resetar Sessão
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal do QR Code (melhorado) */}
        <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Conectar WhatsApp Business
              </DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com seu WhatsApp Business para conectar
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6 space-y-4">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Gerando QR Code...</p>
                  <p className="text-xs text-muted-foreground text-center">
                    Tentando conectar à Evolution API...<br />
                    Isso pode levar até 60 segundos.
                  </p>
                </div>
              ) : qrCode || qrCodeText ? (
                <>
                  <div className="p-4 bg-white rounded-xl shadow-lg">
                    {qrCode ? (
                      <img 
                        src={qrCode} 
                        alt="QR Code WhatsApp" 
                        className="w-64 h-64"
                      />
                    ) : qrCodeText ? (
                      <QRCodeSVG 
                        value={qrCodeText} 
                        size={256}
                        level="M"
                        includeMargin={true}
                      />
                    ) : null}
                  </div>
                  {pairingCode && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Código de pareamento (alternativo):</p>
                      <p className="text-lg font-mono font-bold tracking-widest">{pairingCode}</p>
                    </div>
                  )}
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">Instruções:</p>
                    <ol className="text-sm text-muted-foreground text-left list-decimal list-inside space-y-1">
                      <li>Abra o WhatsApp Business no celular</li>
                      <li>Vá em Configurações → Dispositivos Conectados</li>
                      <li>Toque em "Conectar Dispositivo"</li>
                      <li>Escaneie este QR Code</li>
                    </ol>
                  </div>
                  <Button variant="outline" onClick={handleGenerateQR}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Gerar Novo QR Code
                  </Button>
                </>
              ) : pairingCode && !qrError ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Smartphone className="w-12 h-12 text-primary" />
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Use o código de pareamento:</p>
                    <p className="text-2xl font-mono font-bold tracking-widest">{pairingCode}</p>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    No WhatsApp, vá em Configurações → Dispositivos Conectados<br />
                    e digite este código.
                  </p>
                  <Button variant="outline" onClick={handleGenerateQR}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar QR Code
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-6 w-full">
                  <AlertTriangle className="w-12 h-12 text-yellow-500" />
                  <div className="text-center">
                    <p className="font-medium text-destructive mb-2">Falha ao gerar QR Code</p>
                    <p className="text-sm text-muted-foreground">
                      {qrError || 'Não foi possível conectar à Evolution API.'}
                    </p>
                  </div>

                  {qrProgress && (
                    <div className="w-full p-3 bg-muted rounded-lg text-sm">
                      <p className="text-muted-foreground">
                        Tentativas: {qrProgress.attempt}/{qrProgress.maxAttempts}
                      </p>
                      {qrProgress.state && (
                        <p className="text-muted-foreground">Estado: {qrProgress.state}</p>
                      )}
                    </div>
                  )}

                  <div className="w-full p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="font-medium text-sm mb-2">Ações Sugeridas:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Tente "Resetar Sessão" e gere o QR novamente</li>
                      <li>• Se persistir, use "Recriar Instância"</li>
                      <li>• Verifique se o Cloudflare Tunnel está ativo</li>
                    </ul>
                  </div>

                  <div className="flex gap-2 flex-wrap justify-center">
                    <Button 
                      variant="outline" 
                      onClick={handleResetSession}
                      disabled={resettingSession}
                    >
                      {resettingSession ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Resetar Sessão
                    </Button>
                    <Button onClick={handleGenerateQR}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Visualização de Campanha */}
        <Dialog open={!!viewingCampaign} onOpenChange={(open) => !open && setViewingCampaign(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Detalhes da Campanha
              </DialogTitle>
              <DialogDescription>
                Visualize os detalhes e estatísticas da campanha
              </DialogDescription>
            </DialogHeader>
            {viewingCampaign && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-lg">{viewingCampaign.name}</p>
                    {getStatusBadge(viewingCampaign.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Criada em: {format(new Date(viewingCampaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {viewingCampaign.scheduled_for && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Agendada para: {format(new Date(viewingCampaign.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Mensagem:</p>
                  <p className="text-sm whitespace-pre-wrap">{viewingCampaign.message}</p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setViewingCampaign(null)}>
                    Fechar
                  </Button>
                  <Button onClick={() => {
                    setSelectedCampaign(viewingCampaign);
                    setViewingCampaign(null);
                  }}>
                    Selecionar Campanha
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Edição de Campanha */}
        <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && setEditingCampaign(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                Editar Campanha
              </DialogTitle>
              <DialogDescription>
                Altere os dados da campanha
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome da Campanha</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-message">Mensagem</Label>
                <Textarea
                  id="edit-message"
                  value={editForm.message}
                  onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-scheduled">Agendamento (opcional)</Label>
                <Input
                  id="edit-scheduled"
                  type="datetime-local"
                  value={editForm.scheduled_for}
                  onChange={(e) => setEditForm({ ...editForm, scheduled_for: e.target.value })}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingCampaign(null)} disabled={savingCampaign}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCampaign} disabled={savingCampaign}>
                  {savingCampaign ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
        <AlertDialog open={!!deletingCampaign} onOpenChange={(open) => !open && setDeletingCampaign(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a campanha <strong>"{deletingCampaign?.name}"</strong>?
                <br /><br />
                Esta ação é irreversível e todos os destinatários na fila serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingCampaignLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCampaign}
                disabled={deletingCampaignLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingCampaignLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Confirmação de Cancelamento de Disparo */}
        <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Pause className="w-5 h-5 text-orange-500" />
                Parar disparo?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá <strong>pausar</strong> a campanha 
                <strong> "{selectedCampaign?.name}"</strong>.
                <br /><br />
                <span className="text-muted-foreground">
                  • {stats.pending} destinatário(s) pendente(s) continuarão disponíveis para envio posterior
                </span>
                <br />
                • {stats.sent} mensagem(s) já enviada(s) não serão afetadas
                <br /><br />
                Você pode retomar o disparo a qualquer momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStopDispatch}
                disabled={cancelling}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                {cancelling ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parando...</>
                ) : (
                  <><Pause className="w-4 h-4 mr-2" /> Parar Disparo</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Template (Criar/Editar) */}
        <Dialog open={showTemplateModal} onOpenChange={(open) => {
          if (!open) {
            setShowTemplateModal(false);
            setEditingTemplate(null);
            setTemplateForm({ name: '', body: '', category: 'MARKETING', footer: '' });
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? 'Atualize os dados da mensagem pronta.'
                  : 'Crie uma mensagem pronta para usar em campanhas.'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  placeholder="Ex: Boas-vindas, Promoção Semanal..."
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-category">Categoria</Label>
                <Select 
                  value={templateForm.category} 
                  onValueChange={(v) => setTemplateForm(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utilitário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-body">Mensagem</Label>
                <Textarea
                  id="template-body"
                  placeholder="Olá {{nome}}! Temos uma novidade para você..."
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{nome}}"} para personalizar com o nome do cliente.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-footer">Rodapé (opcional)</Label>
                <Input
                  id="template-footer"
                  placeholder="Ex: Grupo Pará Combustíveis"
                  value={templateForm.footer}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, footer: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                    setTemplateForm({ name: '', body: '', category: 'MARKETING', footer: '' });
                  }}
                  disabled={savingTemplate}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
                  {savingTemplate ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <>{editingTemplate ? 'Salvar' : 'Criar Template'}</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão de Template */}
        <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir template?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o template <strong>"{deletingTemplate?.name}"</strong>?
                <br /><br />
                Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingTemplateLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTemplate}
                disabled={deletingTemplateLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingTemplateLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Prontas</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Criar</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Campanhas</span>
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Fila</span>
            </TabsTrigger>
            <TabsTrigger value="dispatch" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Disparo</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB: Templates / Mensagens Prontas */}
          <TabsContent value="templates" className="space-y-6">
            {/* SEÇÃO 1: Mensagens Automáticas do Robô */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Mensagens Automáticas do Robô
                </CardTitle>
                <CardDescription>
                  Mensagens enviadas automaticamente pelo sistema (não são disparos de campanha)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Mensagem de Boas-Vindas */}
                  <div className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📨</span>
                        <div>
                          <h4 className="font-semibold">Mensagem de Boas-Vindas</h4>
                          <p className="text-xs text-muted-foreground">Primeiro contato com o cliente</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      Enviada automaticamente quando um novo cliente inicia conversa no WhatsApp pela primeira vez.
                    </p>
                    <MessageEditorButton
                      settingKey="whatsapp_welcome_message"
                      title="Mensagem de Boas-Vindas"
                      description="Enviada automaticamente no primeiro contato com o cliente"
                      variables={[
                        { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' }
                      ]}
                      defaultMessage={`👋 Olá! Seja muito bem-vindo(a) ao Auto Posto Pará!

É um prazer ter você com a gente. Obrigado pela confiança e preferência 🤝

Por aqui você vai receber informações importantes, promoções exclusivas e novidades especiais.

🎉 Participação confirmada!
Você já está participando do sorteio do Posto 7.

🏆 Sorteio semanal
📅 Data: todos os sábados
⏰ Horário: 17h
🎁 Prêmios: 3 sorteios de R$ 100,00

📞 Caso seja contemplado, entraremos em contato por este mesmo número.

⚡ Fique atento(a): promoções relâmpago com descontos de até R$ 0,80 por litro.

Antes de continuar, queremos te chamar pelo nome 😊

👉 Por favor, informe seu *nome e sobrenome* no campo abaixo:`}
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-full"
                    />
                  </div>

                  {/* Mensagem do Ganhador do Sorteio */}
                  <div className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎉</span>
                        <div>
                          <h4 className="font-semibold">Mensagem do Ganhador</h4>
                          <p className="text-xs text-muted-foreground">Sorteio premiado</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      Enviada automaticamente quando o cliente ganha um sorteio. Notifica sobre o prêmio conquistado.
                    </p>
                    <MessageEditorButton
                      settingKey="whatsapp_raffle_winner_message"
                      title="Mensagem do Ganhador"
                      description="Enviada quando o cliente ganha o sorteio"
                      variables={[
                        { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' },
                        { key: '{{1}}', desc: 'Nome do cliente (alternativo)', example: 'João Silva' },
                        { key: '{{sorteio}}', desc: 'Nome do sorteio', example: 'Sorteio Semanal' },
                        { key: '{{premio}}', desc: 'Valor do prêmio', example: 'R$ 100,00' }
                      ]}
                      defaultMessage={`🎉 *PARABÉNS {{nome}}!* 🎉

Você foi sorteado(a) no *{{sorteio}}*!

🏆 Seu prêmio: *{{premio}}*

Entre em contato conosco para retirar seu prêmio. Estamos muito felizes por você! 🥳

Auto Posto Pará – Economia de verdade!`}
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-full"
                    />
                  </div>

                  {/* Mensagem de Despedida */}
                  <div className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">👋</span>
                        <div>
                          <h4 className="font-semibold">Mensagem de Despedida</h4>
                          <p className="text-xs text-muted-foreground">Encerrar conversa</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      Enviada quando o cliente encerra a conversa (SAIR, STOP, etc.). Não bloqueia futuros disparos.
                    </p>
                    <MessageEditorButton
                      settingKey="whatsapp_farewell_message"
                      title="Mensagem de Despedida"
                      description="Enviada quando o cliente encerra a conversa"
                      variables={[
                        { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' }
                      ]}
                      defaultMessage={`Obrigado pelo contato, {{nome}}! 😊

Foi um prazer falar com você. Estamos sempre à disposição para ajudar.

Até a próxima! 🙋
Auto Posto Pará – Economia de verdade!`}
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-full"
                    />
                  </div>

                  {/* Mensagem de Solicitação de Nome */}
                  <div className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✍️</span>
                        <div>
                          <h4 className="font-semibold">Solicitação de Nome</h4>
                          <p className="text-xs text-muted-foreground">Coletar identificação</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      Enviada quando precisamos coletar o nome do cliente para personalizar futuras mensagens.
                    </p>
                    <MessageEditorButton
                      settingKey="whatsapp_ask_name_message"
                      title="Solicitação de Nome"
                      description="Enviada para coletar o nome do cliente"
                      variables={[]}
                      defaultMessage={`Para personalizarmos seu atendimento, por favor informe seu *nome e sobrenome*:`}
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-full"
                    />
                  </div>

                  {/* Mensagem de Confirmação de Nome */}
                  <div className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <div>
                          <h4 className="font-semibold">Confirmação de Nome</h4>
                          <p className="text-xs text-muted-foreground">Nome registrado</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      Enviada após o cliente informar o nome, confirmando que foi registrado com sucesso.
                    </p>
                    <MessageEditorButton
                      settingKey="whatsapp_name_confirmed_message"
                      title="Confirmação de Nome"
                      description="Enviada após registrar o nome do cliente"
                      variables={[
                        { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' }
                      ]}
                      defaultMessage={`Obrigado, {{nome}}! 🎉

Seu nome foi registrado. Agora você receberá todas as nossas promoções e novidades personalizadas!

Se precisar de algo, é só chamar. 😊`}
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-full"
                    />
                  </div>

                  {/* Mensagem Padrão do Chatbot */}
                  <div className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <div>
                          <h4 className="font-semibold">Resposta Padrão</h4>
                          <p className="text-xs text-muted-foreground">Chatbot IA</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      Resposta automática do chatbot quando o cliente envia mensagens gerais.
                    </p>
                    <MessageEditorButton
                      settingKey="whatsapp_default_response"
                      title="Resposta Padrão do Chatbot"
                      description="Resposta automática para mensagens gerais"
                      variables={[
                        { key: '{{nome}}', desc: 'Nome do cliente', example: 'João Silva' }
                      ]}
                      defaultMessage={`Olá, {{nome}}! 👋

Estou aqui para ajudar! Se tiver alguma dúvida sobre nossas promoções, sorteios ou serviços, é só perguntar.

Auto Posto Pará – Economia de verdade!`}
                      buttonVariant="outline"
                      buttonSize="sm"
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO 2: Templates para Campanhas */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Templates para Campanhas
                    </CardTitle>
                    <CardDescription>
                      Modelos de mensagens para usar em disparos manuais de campanha.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={loadTemplates} disabled={loadingTemplates}>
                      <RefreshCw className={`w-4 h-4 ${loadingTemplates ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={handleOpenNewTemplate}>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Template
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-10"
                  />
                  {templateSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                      onClick={() => setTemplateSearch('')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Lista de Templates */}
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {templates.length === 0 
                      ? (
                        <div className="space-y-4">
                          <FileText className="w-12 h-12 mx-auto opacity-50" />
                          <div>
                            <p className="font-medium">Nenhum template criado ainda</p>
                            <p className="text-sm">Crie mensagens prontas para agilizar suas campanhas.</p>
                          </div>
                          <Button onClick={handleOpenNewTemplate} variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            Criar primeiro template
                          </Button>
                        </div>
                      )
                      : 'Nenhum template encontrado com esse filtro.'
                    }
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-4">
                      {filteredTemplates.map(template => (
                        <Card key={template.id} className="border">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-base">{template.name}</CardTitle>
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      template.category === 'MARKETING' 
                                        ? 'border-blue-400 text-blue-600' 
                                        : 'border-green-400 text-green-600'
                                    }
                                  >
                                    {template.category === 'MARKETING' ? 'Marketing' : 'Utilitário'}
                                  </Badge>
                                  {template.status === 'approved' && (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Aprovado
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-xs mt-1">
                                  Criado em {format(new Date(template.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap max-h-32 overflow-hidden relative">
                              {template.body.substring(0, 250)}
                              {template.body.length > 250 && (
                                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted to-transparent" />
                              )}
                            </div>
                            {template.footer && (
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                Rodapé: {template.footer}
                              </p>
                            )}
                          </CardContent>
                          <div className="px-6 pb-4 flex gap-2 flex-wrap">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleUseTemplate(template)}
                              className="flex-1"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Usar em Campanha
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenEditTemplate(template)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingTemplate(template)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {filteredTemplates.length} template(s) disponível(is)
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Criar Campanha */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Nova Campanha
                </CardTitle>
                <CardDescription>
                  Crie uma campanha de mensagens promocionais. Use {"{{nome}}"} para personalizar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Promoção Natal 2026"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="message">Mensagem</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                      onClick={handleGenerateVariations}
                      disabled={generatingVariations || !campaignMessage.trim()}
                    >
                      {generatingVariations ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      Gerar Variações com IA
                    </Button>
                  </div>
                  <Textarea
                    id="message"
                    placeholder="Olá {{nome}}! Aproveite nossa promoção..."
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    O rodapé "Para parar de receber, responda SAIR." será adicionado automaticamente.
                  </p>

                  {previewVariations.length > 0 && (
                    <div className="mt-4 space-y-2 bg-muted/50 p-4 rounded-lg border border-dashed">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-muted-foreground">Exemplos de como seus clientes receberão (Variações geradas):</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {previewVariations.map((example, i) => (
                          <div key={i} className="text-xs p-2 bg-background rounded border text-muted-foreground">
                            <span className="font-semibold mr-2 text-primary">Variação {i + 1}:</span>
                            {example}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center mt-2">
                        * O sistema irá gerar milhares de combinações únicas automaticamente.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled">Agendamento (opcional)</Label>
                  <Input
                    id="scheduled"
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={handleCreateCampaign} 
                  disabled={creating}
                  className="w-full"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" /> Criar Campanha</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Campanhas (gerenciar) */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <List className="w-5 h-5" />
                    Campanhas
                  </span>
                  <Button variant="ghost" size="icon" onClick={loadCampaigns} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Visualize, edite ou exclua suas campanhas de WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar campanhas..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    className="pl-10"
                  />
                  {campaignSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                      onClick={() => setCampaignSearch('')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Tabela de campanhas */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {campaigns.length === 0 
                      ? 'Nenhuma campanha criada ainda.'
                      : 'Nenhuma campanha encontrada com esse filtro.'
                    }
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Criada</TableHead>
                          <TableHead className="hidden md:table-cell">Agendamento</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCampaigns.map(campaign => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {campaign.name}
                            </TableCell>
                            <TableCell className="text-center">
                              {getStatusBadge(campaign.status)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                              {format(new Date(campaign.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {campaign.scheduled_for 
                                ? format(new Date(campaign.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Visualizar"
                                  onClick={() => setViewingCampaign(campaign)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Editar"
                                  onClick={() => handleOpenEdit(campaign)}
                                  disabled={campaign.status === 'sending'}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Excluir"
                                  onClick={() => setDeletingCampaign(campaign)}
                                  disabled={campaign.status === 'sending'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {filteredCampaigns.length} campanha(s) • Campanhas em "Enviando" não podem ser editadas ou excluídas.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Gerar Fila */}
          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gerar Fila de Destinatários
                </CardTitle>
                <CardDescription>
                  Selecione uma campanha e escolha os clientes para adicionar à fila.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campanha Selecionada</Label>
                  <select
                    className="w-full p-2 border rounded-md bg-background"
                    value={selectedCampaign?.id || ''}
                    onChange={(e) => {
                      const camp = campaigns.find(c => c.id === e.target.value);
                      setSelectedCampaign(camp || null);
                    }}
                  >
                    <option value="">Selecione uma campanha...</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCampaign && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p><strong>Mensagem:</strong></p>
                    <p className="text-sm whitespace-pre-wrap">{selectedCampaign.message}</p>
                  </div>
                )}

                {/* Stats da campanha */}
                {selectedCampaign && (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-muted rounded">
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Na fila</p>
                    </div>
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                      <p className="text-xs text-muted-foreground">Enviados</p>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                      <p className="text-xs text-muted-foreground">Falhas</p>
                    </div>
                  </div>
                )}

                {queueCount !== null && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p className="font-semibold">{queueCount} contato(s) adicionado(s)!</p>
                  </div>
                )}

                {/* Tabela de clientes elegíveis */}
                {selectedCampaign && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <Label className="text-base font-semibold">
                          Clientes Elegíveis ({eligibleCustomers.length} disponíveis)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {showAllCustomers 
                            ? 'Mostrando todos os clientes cadastrados (incluindo sem opt-in).'
                            : 'Clientes com LGPD + Marketing aceitos, não em opt-out e não na fila.'}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => loadEligibleCustomers(selectedCampaign.id)}
                        disabled={loadingCustomers}
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingCustomers ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {/* Toggle para mostrar todos os clientes */}
                    <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-lg">
                      <Checkbox
                        id="show-all-customers"
                        checked={showAllCustomers}
                        onCheckedChange={(checked) => {
                          setShowAllCustomers(!!checked);
                          // Recarregar ao mudar
                          setTimeout(() => loadEligibleCustomers(selectedCampaign.id), 0);
                        }}
                      />
                      <Label htmlFor="show-all-customers" className="cursor-pointer text-sm">
                        Mostrar todos os clientes (incluir sem opt-in de marketing)
                      </Label>
                    </div>

                    {/* Busca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome ou telefone..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-10"
                      />
                      {customerSearch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          onClick={() => setCustomerSearch('')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Selecionar todos + contador */}
                    <div className="flex items-center justify-between py-2 px-1 border-b">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="select-all"
                          checked={selectedCustomers.size === filteredEligibleCustomers.length && filteredEligibleCustomers.length > 0}
                          onCheckedChange={toggleSelectAll}
                          disabled={filteredEligibleCustomers.length === 0}
                        />
                        <Label htmlFor="select-all" className="cursor-pointer text-sm font-medium">
                          Selecionar Todos
                        </Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {selectedCustomers.size} de {filteredEligibleCustomers.length} selecionado(s)
                      </span>
                    </div>

                    {/* Lista de clientes */}
                    {loadingCustomers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredEligibleCustomers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {eligibleCustomers.length === 0 
                          ? 'Nenhum cliente elegível (todos já estão na fila ou em opt-out)'
                          : 'Nenhum cliente encontrado com esse filtro'
                        }
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEligibleCustomers.map((customer) => (
                              <TableRow 
                                key={customer.phone_e164}
                                className={`cursor-pointer ${selectedCustomers.has(customer.phone_e164) ? 'bg-primary/5' : ''}`}
                                onClick={() => toggleCustomerSelection(customer.phone_e164)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedCustomers.has(customer.phone_e164)}
                                    onCheckedChange={() => toggleCustomerSelection(customer.phone_e164)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {customer.phone_e164}
                                </TableCell>
                                <TableCell>
                                  {customer.name || <span className="text-muted-foreground italic">Sem nome</span>}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-center">
                                    <Badge variant="secondary" className="text-xs">LGPD</Badge>
                                    <Badge variant="secondary" className="text-xs">MKT</Badge>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}

                    {/* Botões de ação */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={() => handleGenerateQueue(false)} 
                        disabled={generating || selectedCustomers.size === 0}
                        className="flex-1"
                      >
                        {generating ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adicionando...</>
                        ) : (
                          <><Plus className="w-4 h-4 mr-2" /> Adicionar {selectedCustomers.size} Selecionado(s)</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Disparo */}
          <TabsContent value="dispatch">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Lista de campanhas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      Campanhas
                    </span>
                    <Button variant="ghost" size="icon" onClick={loadCampaigns}>
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {campaigns.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma campanha criada ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {campaigns.map(c => (
                          <div 
                            key={c.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedCampaign?.id === c.id 
                                ? 'border-primary bg-primary/5' 
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => setSelectedCampaign(c)}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{c.name}</p>
                              {getStatusBadge(c.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Painel de disparo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Controle de Disparo
                  </CardTitle>
                  <CardDescription>
                    {selectedCampaign 
                      ? `Campanha: ${selectedCampaign.name}` 
                      : 'Selecione uma campanha ao lado'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedCampaign ? (
                    <>
                      {/* Indicador de disparo em andamento com BARRA DE PROGRESSO */}
                      {selectedCampaign.status === 'sending' && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                          {/* Header com botão Parar */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                              <span className="font-medium text-blue-700 dark:text-blue-300">
                                Disparo em andamento
                                {autoDispatchActive && <span className="text-xs ml-2">(auto)</span>}
                              </span>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowCancelConfirm(true)}
                              disabled={cancelling}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            >
                              {cancelling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <><Pause className="w-4 h-4 mr-1" /> Parar</>
                              )}
                            </Button>
                          </div>
                          
                          {/* Barra de Progresso Visual */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm text-blue-700 dark:text-blue-300">
                              <span className="font-bold text-lg">
                                {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}%
                              </span>
                              <span>{stats.sent} de {stats.total} enviados</span>
                            </div>
                            <Progress 
                              value={stats.total > 0 ? (stats.sent / stats.total) * 100 : 0} 
                              className="h-4" 
                            />
                          </div>
                          
                          {/* Info adicional */}
                          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                            <span>
                              Pendentes: {stats.pending} • Falhas: {stats.failed} • Ignorados: {stats.skipped}
                            </span>
                            <span>
                              ~{Math.ceil((stats.pending * 12) / 60)} min restantes
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-muted rounded">
                          <p className="text-xl font-bold">{stats.total}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
                          <p className="text-xs text-muted-foreground">Pendentes</p>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <p className="text-xl font-bold text-green-600">{stats.sent}</p>
                          <p className="text-xs text-muted-foreground">Enviados</p>
                        </div>
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <p className="text-xl font-bold text-red-600">{stats.failed}</p>
                          <p className="text-xs text-muted-foreground">Falhas</p>
                        </div>
                      </div>

                      {/* Modo de envio */}
                      <div className="space-y-2">
                        <Label>Modo de Envio</Label>
                        <Select value={sendMode} onValueChange={(v: SendMode) => setSendMode(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SEND_MODES).map(([key, mode]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <mode.icon className={`w-4 h-4 ${mode.color}`} />
                                  <span>{mode.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {SEND_MODES[sendMode].description}
                        </p>
                      </div>

                      {/* Card de Teste de Envio */}
                      <Card className="border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-900/10">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Testar Envio
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Envie uma mensagem de teste antes de disparar para todos
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Número de teste */}
                          <div className="space-y-1">
                            <Label className="text-xs">Número de Teste</Label>
                            <Input 
                              placeholder="5594991234567"
                              value={testPhone}
                              onChange={(e) => setTestPhone(e.target.value)}
                              className="h-9"
                            />
                          </div>
                          
                          {/* Checkbox usar mensagem da campanha */}
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="use-campaign-msg"
                              checked={useCampaignMessage}
                              onCheckedChange={(v) => setUseCampaignMessage(!!v)}
                              disabled={!selectedCampaign}
                            />
                            <Label htmlFor="use-campaign-msg" className="text-xs cursor-pointer">
                              Usar mensagem da campanha
                            </Label>
                          </div>
                          
                          {/* Mensagem customizada (se não usar da campanha) */}
                          {!useCampaignMessage && (
                            <div className="space-y-1">
                              <Label className="text-xs">Mensagem de Teste</Label>
                              <Textarea 
                                placeholder="Digite sua mensagem de teste..."
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                rows={3}
                                className="text-sm"
                              />
                            </div>
                          )}
                          
                          {/* Preview da mensagem (se usar da campanha) */}
                          {useCampaignMessage && selectedCampaign && (
                            <div className="bg-white dark:bg-background p-2 rounded border text-xs text-muted-foreground max-h-24 overflow-auto">
                              <p className="font-medium mb-1">Preview ({"{{nome}}"} → Teste):</p>
                              <p className="whitespace-pre-wrap">
                                {selectedCampaign.message.substring(0, 200).replace(/\{\{nome\}\}/gi, 'Teste')}
                                {selectedCampaign.message.length > 200 && '...'}
                              </p>
                            </div>
                          )}
                          
                          {/* Resultado do último teste */}
                          {lastTestResult && (
                            <div className={`p-2 rounded text-xs flex items-center gap-2 ${
                              lastTestResult.success 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {lastTestResult.success 
                                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> 
                                : <XCircle className="w-4 h-4 flex-shrink-0" />
                              }
                              <span className="flex-1 truncate">{lastTestResult.message}</span>
                              <span className="text-[10px] opacity-70">
                                {format(lastTestResult.timestamp, 'HH:mm')}
                              </span>
                            </div>
                          )}
                          
                          {/* Botão de enviar teste */}
                          <Button 
                            onClick={handleSendTest}
                            disabled={sendingTest || !connectionStatus.connected}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            {sendingTest ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                            ) : (
                              <><Send className="w-4 h-4 mr-2" /> Enviar Teste</>
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Botões de ação */}
                      <div className="flex gap-2">
                        {selectedCampaign.status === 'sending' ? (
                          <>
                            <Button 
                              onClick={handlePause} 
                              variant="outline" 
                              className="flex-1"
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setShowCancelConfirm(true)}
                              disabled={cancelling}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Parar Disparo
                            </Button>
                          </>
                        ) : selectedCampaign.status === 'paused' ? (
                          <>
                            <Button 
                              onClick={handleContinueDispatch} 
                              className="flex-1"
                              disabled={stats.pending === 0 || !connectionStatus.connected}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Continuar Disparo ({stats.pending})
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setShowCancelConfirm(true)}
                              disabled={cancelling}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Parar
                            </Button>
                          </>
                        ) : selectedCampaign.status === 'cancelled' ? (
                          <div className="flex-1 p-3 bg-muted rounded-lg text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4" />
                            Campanha finalizada
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-1">
                            <Button 
                              onClick={handleOpenAddAndDispatch}
                              disabled={dispatching || !connectionStatus.connected}
                              variant="outline"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Adicionar e Disparar
                            </Button>
                            <Button 
                              onClick={handleOpenDispatchModal} 
                              disabled={dispatching || stats.pending === 0 || !connectionStatus.connected}
                              className="flex-1"
                            >
                              {dispatching ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando...</>
                              ) : (
                                <><Users className="w-4 h-4 mr-2" /> Selecionar e Disparar ({stats.pending})</>
                              )}
                            </Button>
                          </div>
                        )}
                        <Button 
                          variant="outline" 
                          onClick={() => loadRecipients(selectedCampaign.id)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>

                      {!connectionStatus.connected && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-600 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          WhatsApp desconectado. Conecte primeiro.
                        </div>
                      )}

                      {/* Lista de recipients (últimos) */}
                      {recipients.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Últimos destinatários:</p>
                          <ScrollArea className="h-[200px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Telefone</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Timer</TableHead>
                                  <TableHead>Variação</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {recipients.slice(0, 50).map(r => (
                                  <TableRow key={r.id}>
                                    <TableCell className="font-mono text-xs">
                                      {r.phone_e164}
                                      {r.customer_name && (
                                        <span className="text-muted-foreground ml-2">
                                          ({r.customer_name})
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {r.dispatch_latency_ms ? `${(r.dispatch_latency_ms / 1000).toFixed(1)}s` : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.sent_content || ''}>
                                      {r.sent_content || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Selecione uma campanha para gerenciar o disparo</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações
                </CardTitle>
                <CardDescription>
                  Configurações gerais do sistema e integrações.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key">Chave de API da OpenAI</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="sk-..."
                      value={openAiApiKey}
                      onChange={(e) => setOpenAiApiKey(e.target.value)}
                    />
                    <Button onClick={handleSaveApiKey}>
                      Salvar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Esta chave será usada para gerar variações de mensagens com IA.
                    A chave fica salva apenas no seu navegador.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Seleção de Destinatários para Disparo */}
      <Dialog open={showDispatchModal} onOpenChange={setShowDispatchModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Selecionar Destinatários
            </DialogTitle>
            <DialogDescription>
              {selectedCampaign && (
                <span>Campanha: <strong>{selectedCampaign.name}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Busca */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone ou nome..."
                value={dispatchSearch}
                onChange={(e) => setDispatchSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Selecionar Todos */}
            {(() => {
              const pendingRecipients = recipients.filter(r => r.status === 'pending');
              const filteredPending = dispatchSearch
                ? pendingRecipients.filter(r => 
                    r.phone_e164.includes(dispatchSearch) || 
                    r.customer_name?.toLowerCase().includes(dispatchSearch.toLowerCase())
                  )
                : pendingRecipients;
              
              const allSelected = filteredPending.length > 0 && filteredPending.every(r => selectedRecipientsForDispatch.has(r.id));
              
              return (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-3">
                  <Checkbox
                    id="select-all-dispatch"
                    checked={allSelected}
                    onCheckedChange={toggleAllRecipientsForDispatch}
                  />
                  <Label htmlFor="select-all-dispatch" className="cursor-pointer flex-1">
                    Selecionar todos ({filteredPending.length} pendentes)
                  </Label>
                </div>
              );
            })()}
            
            {/* Lista de Recipients */}
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-1">
                {recipients
                  .filter(r => r.status === 'pending')
                  .filter(r => 
                    !dispatchSearch || 
                    r.phone_e164.includes(dispatchSearch) || 
                    r.customer_name?.toLowerCase().includes(dispatchSearch.toLowerCase())
                  )
                  .map(recipient => (
                    <div 
                      key={recipient.id}
                      className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedRecipientsForDispatch.has(recipient.id) ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => toggleRecipientForDispatch(recipient.id)}
                    >
                      <Checkbox
                        checked={selectedRecipientsForDispatch.has(recipient.id)}
                        onCheckedChange={() => toggleRecipientForDispatch(recipient.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm">{recipient.phone_e164}</p>
                        {recipient.customer_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {recipient.customer_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                
                {recipients.filter(r => r.status === 'pending').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum destinatário pendente</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Footer com ações */}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-sm text-muted-foreground">
              {selectedRecipientsForDispatch.size > 0 ? (
                <span className="text-primary font-medium">
                  {selectedRecipientsForDispatch.size} selecionado(s)
                </span>
              ) : (
                'Nenhum selecionado'
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDispatchModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmDispatch}
                disabled={selectedRecipientsForDispatch.size === 0 || dispatching}
              >
                {dispatching ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Disparar para {selectedRecipientsForDispatch.size}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal "Adicionar e Disparar" - Clientes Capturados pelo QR Code */}
      <Dialog open={showAddAndDispatchModal} onOpenChange={setShowAddAndDispatchModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Adicionar e Disparar
            </DialogTitle>
            <DialogDescription>
              {selectedCampaign && (
                <span>Selecione os clientes capturados pelo QR Code para a campanha: <strong>{selectedCampaign.name}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone ou nome..."
                value={quickDispatchSearch}
                onChange={(e) => setQuickDispatchSearch(e.target.value)}
                className="pl-10"
              />
              {quickDispatchSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setQuickDispatchSearch('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {/* Selecionar Todos */}
            {(() => {
              const filtered = eligibleCustomers.filter(c => {
                if (!quickDispatchSearch) return true;
                const search = quickDispatchSearch.toLowerCase();
                return (
                  c.phone_e164.includes(search) ||
                  c.phone.includes(search) ||
                  (c.name && c.name.toLowerCase().includes(search))
                );
              });
              
              const allSelected = filtered.length > 0 && filtered.every(c => selectedForQuickDispatch.has(c.phone_e164));
              
              return (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="select-all-quick"
                    checked={allSelected}
                    onCheckedChange={toggleAllQuickDispatch}
                    disabled={filtered.length === 0}
                  />
                  <Label htmlFor="select-all-quick" className="cursor-pointer flex-1">
                    Selecionar todos ({filtered.length} clientes elegíveis)
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => selectedCampaign && loadEligibleCustomers(selectedCampaign.id)}
                    disabled={loadingCustomers}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCustomers ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              );
            })()}
            
            {/* Lista de Clientes */}
            {loadingCustomers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-2 space-y-1">
                  {eligibleCustomers
                    .filter(c => {
                      if (!quickDispatchSearch) return true;
                      const search = quickDispatchSearch.toLowerCase();
                      return (
                        c.phone_e164.includes(search) ||
                        c.phone.includes(search) ||
                        (c.name && c.name.toLowerCase().includes(search))
                      );
                    })
                    .map(customer => (
                      <div 
                        key={customer.phone_e164}
                        className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedForQuickDispatch.has(customer.phone_e164) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleQuickDispatchSelection(customer.phone_e164)}
                      >
                        <Checkbox
                          checked={selectedForQuickDispatch.has(customer.phone_e164)}
                          onCheckedChange={() => toggleQuickDispatchSelection(customer.phone_e164)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm">{customer.phone_e164}</p>
                          {customer.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {customer.name}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-xs">LGPD</Badge>
                          <Badge variant="secondary" className="text-xs">MKT</Badge>
                        </div>
                      </div>
                    ))}
                  
                  {eligibleCustomers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum cliente elegível disponível</p>
                      <p className="text-xs mt-1">Clientes com LGPD + Marketing aceitos e não na fila</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
          
          {/* Footer com ações */}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-sm text-muted-foreground">
              {selectedForQuickDispatch.size > 0 ? (
                <span className="text-primary font-medium">
                  {selectedForQuickDispatch.size} selecionado(s)
                </span>
              ) : (
                'Nenhum selecionado'
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddAndDispatchModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddAndDispatch}
                disabled={selectedForQuickDispatch.size === 0 || dispatching}
                className="bg-green-600 hover:bg-green-700"
              >
                {dispatching ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adicionando e Disparando...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Disparar para {selectedForQuickDispatch.size} cliente(s)</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
