import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, User, Clock, DollarSign, Hash, Save, RefreshCw, Link2, Loader2, Receipt, Fuel, CheckCircle2, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Users, Plus, Edit2, Trash2, BarChart3, Target, TrendingUp, Activity, TrendingDown, ArrowUpRight, ArrowDownRight, KeyRound } from 'lucide-react';
import FrentistaPinDialog from '@/components/admin/FrentistaPinDialog';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, subHours, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

interface FrentistaMeta {
  id: string;
  frentista_id: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  target_checkins: number;
  target_amount: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

interface TefLog {
  id: string;
  checkin_id: string | null;
  frentista_id: string;
  frentista_nome: string;
  horario: string;
  valor: number;
  forma_pagamento: string;
  nsu: string;
  autorizacao: string;
  bandeira: string;
  parcelas: number;
  terminal_id: string;
  status: string;
  created_at: string;
}

interface Checkin {
  id: string;
  phone: string;
  amount: number | null;
  created_at: string;
  customers: { name: string | null } | null;
}

interface ImportResult {
  total: number;
  imported: number;
  linked: number;
  errors: string[];
}

interface Frentista {
  id: string;
  codigo: string;
  nome: string;
  terminal_id: string | null;
  is_active: boolean;
  created_at: string;
  atendimentos?: number;
  meta?: FrentistaMeta;
  metaProgress?: number;
  periodCheckins?: number;
}

export default function AdminFrentista() {
  const { toast } = useToast();
  const { playSuccessSound } = useSuccessSound();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [tefLogs, setTefLogs] = useState<TefLog[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedTef, setSelectedTef] = useState<TefLog | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Frentistas management
  const [frentistas, setFrentistas] = useState<Frentista[]>([]);
  const [showFrentistaDialog, setShowFrentistaDialog] = useState(false);
  const [editingFrentista, setEditingFrentista] = useState<Frentista | null>(null);
  const [frentistaForm, setFrentistaForm] = useState({ codigo: '', nome: '', terminal_id: '' });
  
  // Metas management
  const [showMetaDialog, setShowMetaDialog] = useState(false);
  const [selectedFrentistaForMeta, setSelectedFrentistaForMeta] = useState<Frentista | null>(null);
  const [metaForm, setMetaForm] = useState({
    period_type: 'monthly' as 'daily' | 'weekly' | 'monthly',
    target_checkins: 50,
    target_amount: ''
  });
  
  // PIN management
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [selectedFrentistaForPin, setSelectedFrentistaForPin] = useState<Frentista | null>(null);

  // Form state
  const [form, setForm] = useState({
    frentista_id: '',
    frentista_nome: '',
    valor: '',
    forma_pagamento: 'debito',
    nsu: '',
    autorizacao: '',
    bandeira: '',
    parcelas: '1',
    terminal_id: ''
  });

  useEffect(() => {
    fetchTefLogs();
    fetchRecentCheckins();
    fetchFrentistas();
    
    // Configurar Realtime para receber transações Stone automaticamente
    const channel = supabase
      .channel('stone-tef-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stone_tef_logs'
        },
        (payload) => {
          console.log('[Realtime] Nova transação Stone recebida:', payload);
          const newTef = payload.new as TefLog;
          
          // Adicionar nova transação no topo da lista
          setTefLogs((prev) => [newTef, ...prev.slice(0, 99)]);
          
          // Tocar som de notificação e vibrar
          playSuccessSound();
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]); // Padrão de vibração: vibra-pausa-vibra
          }
          
          // Notificar usuário
          toast({
            title: '💳 Nova Transação Stone',
            description: `R$ ${Number(newTef.valor).toFixed(2)} - ${newTef.frentista_nome || 'Frentista não identificado'}`,
          });
          
          // Atualizar estatísticas dos frentistas
          fetchFrentistas();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stone_tef_logs'
        },
        (payload) => {
          console.log('[Realtime] Transação Stone atualizada:', payload);
          const updatedTef = payload.new as TefLog;
          
          // Atualizar transação na lista
          setTefLogs((prev) => 
            prev.map(t => t.id === updatedTef.id ? updatedTef : t)
          );
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da conexão:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      console.log('[Realtime] Desconectando canal...');
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFrentistas = async () => {
    const { data: frentistasData } = await supabase
      .from('frentistas')
      .select('*')
      .order('nome');
    
    if (frentistasData) {
      // Get all checkins
      const { data: checkinCounts } = await supabase
        .from('checkins')
        .select('attendant_code, created_at');
      
      // Get active metas
      const { data: metas } = await supabase
        .from('frentista_metas')
        .select('*')
        .eq('is_active', true);
      
      const countMap: Record<string, number> = {};
      (checkinCounts || []).forEach((c: any) => {
        if (c.attendant_code) {
          countMap[c.attendant_code] = (countMap[c.attendant_code] || 0) + 1;
        }
      });

      const frentistasWithStats = frentistasData.map((f: any) => {
        const meta = (metas || []).find((m: any) => m.frentista_id === f.id);
        let periodCheckins = 0;
        let metaProgress = 0;
        
        if (meta) {
          const now = new Date();
          let periodStart: Date;
          let periodEnd: Date;
          
          switch (meta.period_type) {
            case 'daily':
              periodStart = startOfDay(now);
              periodEnd = endOfDay(now);
              break;
            case 'weekly':
              periodStart = startOfWeek(now, { weekStartsOn: 1 });
              periodEnd = endOfWeek(now, { weekStartsOn: 1 });
              break;
            case 'monthly':
            default:
              periodStart = startOfMonth(now);
              periodEnd = endOfMonth(now);
              break;
          }
          
          periodCheckins = (checkinCounts || []).filter((c: any) => {
            if (c.attendant_code !== f.codigo) return false;
            const checkinDate = new Date(c.created_at);
            return checkinDate >= periodStart && checkinDate <= periodEnd;
          }).length;
          
          metaProgress = Math.min(100, Math.round((periodCheckins / meta.target_checkins) * 100));
        }
        
        return {
          ...f,
          atendimentos: countMap[f.codigo] || 0,
          meta,
          periodCheckins,
          metaProgress
        };
      });
      
      setFrentistas(frentistasWithStats);
    }
  };

  const saveFrentista = async () => {
    if (!frentistaForm.codigo || !frentistaForm.nome) {
      toast({ title: 'Preencha código e nome', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: frentistaForm.codigo,
        nome: frentistaForm.nome,
        terminal_id: frentistaForm.terminal_id || null
      };
      
      if (editingFrentista) {
        await supabase
          .from('frentistas')
          .update(payload)
          .eq('id', editingFrentista.id);
        toast({ title: 'Frentista atualizado!' });
      } else {
        await supabase
          .from('frentistas')
          .insert(payload);
        toast({ title: 'Frentista cadastrado!' });
      }
      
      setShowFrentistaDialog(false);
      setEditingFrentista(null);
      setFrentistaForm({ codigo: '', nome: '', terminal_id: '' });
      fetchFrentistas();
    } catch (err) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleFrentistaStatus = async (frentista: Frentista) => {
    await supabase
      .from('frentistas')
      .update({ is_active: !frentista.is_active })
      .eq('id', frentista.id);
    fetchFrentistas();
    toast({ title: frentista.is_active ? 'Frentista desativado' : 'Frentista ativado' });
  };

  const openEditFrentista = (frentista: Frentista) => {
    setEditingFrentista(frentista);
    setFrentistaForm({ codigo: frentista.codigo, nome: frentista.nome, terminal_id: frentista.terminal_id || '' });
    setShowFrentistaDialog(true);
  };

  const openMetaDialog = (frentista: Frentista) => {
    setSelectedFrentistaForMeta(frentista);
    if (frentista.meta) {
      setMetaForm({
        period_type: frentista.meta.period_type,
        target_checkins: frentista.meta.target_checkins,
        target_amount: frentista.meta.target_amount?.toString() || ''
      });
    } else {
      setMetaForm({ period_type: 'monthly', target_checkins: 50, target_amount: '' });
    }
    setShowMetaDialog(true);
  };

  const saveMeta = async () => {
    if (!selectedFrentistaForMeta) return;
    
    setSaving(true);
    try {
      const metaData = {
        frentista_id: selectedFrentistaForMeta.id,
        period_type: metaForm.period_type,
        target_checkins: metaForm.target_checkins,
        target_amount: metaForm.target_amount ? parseFloat(metaForm.target_amount) : null
      };

      if (selectedFrentistaForMeta.meta) {
        await supabase
          .from('frentista_metas')
          .update(metaData)
          .eq('id', selectedFrentistaForMeta.meta.id);
      } else {
        await supabase
          .from('frentista_metas')
          .insert(metaData);
      }
      
      toast({ title: 'Meta salva com sucesso!' });
      setShowMetaDialog(false);
      fetchFrentistas();
    } catch (err) {
      toast({ title: 'Erro ao salvar meta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'daily': return 'Diária';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      default: return period;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 70) return 'bg-yellow-500';
    if (progress >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const fetchTefLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stone_tef_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setTefLogs((data as TefLog[]) || []);
    setLoading(false);
  };

  const fetchRecentCheckins = async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('checkins')
      .select('id, phone, amount, created_at, customers(name)')
      .gte('created_at', oneHourAgo)
      .is('stone_tef_id', null)
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentCheckins((data as Checkin[]) || []);
  };

  const handleSubmit = async () => {
    if (!form.frentista_id || !form.valor || !form.forma_pagamento) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('stone_tef_logs').insert({
        frentista_id: form.frentista_id,
        frentista_nome: form.frentista_nome,
        valor: parseFloat(form.valor),
        forma_pagamento: form.forma_pagamento,
        nsu: form.nsu || null,
        autorizacao: form.autorizacao || null,
        bandeira: form.bandeira || null,
        parcelas: parseInt(form.parcelas) || 1,
        terminal_id: form.terminal_id || null,
        status: 'aprovado'
      });

      if (error) throw error;

      toast({ title: 'Transação registrada!' });
      setForm({
        frentista_id: form.frentista_id,
        frentista_nome: form.frentista_nome,
        valor: '',
        forma_pagamento: 'debito',
        nsu: '',
        autorizacao: '',
        bandeira: '',
        parcelas: '1',
        terminal_id: ''
      });
      fetchTefLogs();
    } catch (err) {
      console.error('Error saving TEF:', err);
      toast({ title: 'Erro ao registrar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openLinkDialog = (tef: TefLog) => {
    setSelectedTef(tef);
    fetchRecentCheckins();
    setShowLinkDialog(true);
  };

  const linkToCheckin = async (checkinId: string) => {
    if (!selectedTef) return;

    try {
      // Update TEF log with checkin_id
      await supabase.from('stone_tef_logs').update({ checkin_id: checkinId }).eq('id', selectedTef.id);
      
      // Update checkin with stone_tef_id
      await supabase.from('checkins').update({ stone_tef_id: selectedTef.id }).eq('id', checkinId);

      toast({ title: 'Transação vinculada ao abastecimento!' });
      setShowLinkDialog(false);
      fetchTefLogs();
      fetchRecentCheckins();
    } catch (err) {
      console.error('Error linking:', err);
      toast({ title: 'Erro ao vincular', variant: 'destructive' });
    }
  };

  const getBandeiraBadge = (bandeira: string) => {
    const colors: Record<string, string> = {
      'visa': 'bg-blue-500',
      'mastercard': 'bg-orange-500',
      'elo': 'bg-yellow-500',
      'amex': 'bg-blue-600',
      'hipercard': 'bg-red-500'
    };
    return colors[bandeira?.toLowerCase()] || 'bg-gray-500';
  };

  // Parse CSV and import Stone transactions
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        throw new Error('Arquivo CSV vazio ou inválido');
      }

      // Parse header to find column indices
      const header = lines[0].toLowerCase().split(/[;,]/);
      const getCol = (names: string[]) => {
        for (const name of names) {
          const idx = header.findIndex(h => h.includes(name));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const cols = {
        data: getCol(['data', 'date', 'horario', 'hora']),
        valor: getCol(['valor', 'value', 'amount', 'total']),
        forma: getCol(['forma', 'payment', 'pagamento', 'tipo']),
        nsu: getCol(['nsu']),
        autorizacao: getCol(['autorizacao', 'auth', 'authorization']),
        bandeira: getCol(['bandeira', 'brand', 'flag']),
        parcelas: getCol(['parcelas', 'installments', 'parc']),
        terminal: getCol(['terminal', 'pos', 'maquina']),
        frentista_id: getCol(['frentista', 'operador', 'attendant', 'operator']),
        frentista_nome: getCol(['nome_frentista', 'nome_operador', 'operator_name']),
        status: getCol(['status', 'situacao'])
      };

      const result: ImportResult = { total: 0, imported: 0, linked: 0, errors: [] };
      const dataRows = lines.slice(1);
      result.total = dataRows.length;

      for (let i = 0; i < dataRows.length; i++) {
        try {
          const row = dataRows[i].split(/[;,]/);
          if (row.length < 2) continue;

          // Parse valor
          let valor = 0;
          if (cols.valor >= 0 && row[cols.valor]) {
            valor = parseFloat(row[cols.valor].replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          }
          if (valor <= 0) continue;

          // Parse date
          let horario = new Date().toISOString();
          if (cols.data >= 0 && row[cols.data]) {
            const dateStr = row[cols.data].trim();
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              horario = parsed.toISOString();
            } else {
              const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
              if (match) {
                const [, d, m, y, h = '12', min = '00'] = match;
                horario = new Date(`${y}-${m}-${d}T${h}:${min}:00`).toISOString();
              }
            }
          }

          const tefData = {
            horario,
            valor,
            forma_pagamento: cols.forma >= 0 ? (row[cols.forma]?.trim().toLowerCase() || 'debito') : 'debito',
            nsu: cols.nsu >= 0 ? row[cols.nsu]?.trim() || null : null,
            autorizacao: cols.autorizacao >= 0 ? row[cols.autorizacao]?.trim() || null : null,
            bandeira: cols.bandeira >= 0 ? row[cols.bandeira]?.trim().toLowerCase() || null : null,
            parcelas: cols.parcelas >= 0 ? parseInt(row[cols.parcelas]) || 1 : 1,
            terminal_id: cols.terminal >= 0 ? row[cols.terminal]?.trim() || null : null,
            frentista_id: cols.frentista_id >= 0 ? row[cols.frentista_id]?.trim().toUpperCase() || null : null,
            frentista_nome: cols.frentista_nome >= 0 ? row[cols.frentista_nome]?.trim() || null : null,
            status: cols.status >= 0 ? row[cols.status]?.trim().toLowerCase() || 'aprovado' : 'aprovado'
          };

          const { data: insertedTef, error } = await supabase
            .from('stone_tef_logs')
            .insert(tefData)
            .select('id')
            .single();

          if (error) {
            result.errors.push(`Linha ${i + 2}: ${error.message}`);
            continue;
          }

          result.imported++;

          // Try to auto-link with checkin (same value within 30 min tolerance)
          const tefTime = new Date(horario);
          const minTime = new Date(tefTime.getTime() - 30 * 60 * 1000).toISOString();
          const maxTime = new Date(tefTime.getTime() + 30 * 60 * 1000).toISOString();

          const { data: matchingCheckin } = await supabase
            .from('checkins')
            .select('id')
            .is('stone_tef_id', null)
            .eq('amount', valor)
            .gte('created_at', minTime)
            .lte('created_at', maxTime)
            .limit(1)
            .single();

          if (matchingCheckin) {
            await supabase.from('stone_tef_logs').update({ checkin_id: matchingCheckin.id }).eq('id', insertedTef.id);
            await supabase.from('checkins').update({ stone_tef_id: insertedTef.id }).eq('id', matchingCheckin.id);
            result.linked++;
          }

          setImportProgress(Math.round(((i + 1) / dataRows.length) * 100));
        } catch (rowErr) {
          result.errors.push(`Linha ${i + 2}: Erro ao processar`);
        }
      }

      setImportResult(result);
      toast({ 
        title: 'Importação concluída!',
        description: `${result.imported} importados, ${result.linked} vinculados automaticamente`
      });
      fetchTefLogs();
    } catch (err: any) {
      console.error('Import error:', err);
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Dados calculados para o Dashboard
  const CORES_GRAFICO = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899'];
  
  const dashboardData = useMemo(() => {
    const hoje = startOfDay(new Date());
    const ontem = startOfDay(subDays(new Date(), 1));
    const fimOntem = endOfDay(subDays(new Date(), 1));
    
    const transacoesHoje = tefLogs.filter(t => {
      const data = parseISO(t.horario || t.created_at);
      return data >= hoje;
    });
    
    const transacoesOntem = tefLogs.filter(t => {
      const data = parseISO(t.horario || t.created_at);
      return data >= ontem && data <= fimOntem;
    });
    
    // Dados por hora (últimas 12 horas)
    const porHora: { hora: string; valor: number; qtd: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const horaRef = subHours(new Date(), i);
      const horaStr = format(horaRef, 'HH:00');
      const horaInicio = startOfDay(horaRef);
      horaInicio.setHours(horaRef.getHours());
      const horaFim = new Date(horaInicio);
      horaFim.setHours(horaFim.getHours() + 1);
      
      const transacoesHora = tefLogs.filter(t => {
        const data = parseISO(t.horario || t.created_at);
        return data >= horaInicio && data < horaFim;
      });
      
      porHora.push({
        hora: horaStr,
        valor: transacoesHora.reduce((acc, t) => acc + Number(t.valor), 0),
        qtd: transacoesHora.length
      });
    }
    
    // Dados por forma de pagamento
    const porFormaPgto: { name: string; value: number }[] = [];
    const formasPgto: Record<string, number> = {};
    transacoesHoje.forEach(t => {
      const forma = t.forma_pagamento || 'outro';
      formasPgto[forma] = (formasPgto[forma] || 0) + Number(t.valor);
    });
    Object.entries(formasPgto).forEach(([name, value]) => {
      porFormaPgto.push({ name: name.charAt(0).toUpperCase() + name.slice(1), value });
    });
    
    // Dados por frentista
    const porFrentista: { nome: string; valor: number; qtd: number }[] = [];
    const frentistaMap: Record<string, { valor: number; qtd: number }> = {};
    transacoesHoje.forEach(t => {
      const nome = t.frentista_nome || 'Não identificado';
      if (!frentistaMap[nome]) frentistaMap[nome] = { valor: 0, qtd: 0 };
      frentistaMap[nome].valor += Number(t.valor);
      frentistaMap[nome].qtd += 1;
    });
    Object.entries(frentistaMap)
      .sort((a, b) => b[1].valor - a[1].valor)
      .forEach(([nome, data]) => {
        porFrentista.push({ nome, ...data });
      });
    
    // Totais Hoje
    const totalHoje = transacoesHoje.reduce((acc, t) => acc + Number(t.valor), 0);
    const qtdHoje = transacoesHoje.length;
    const ticketMedio = qtdHoje > 0 ? totalHoje / qtdHoje : 0;
    
    // Totais Ontem
    const totalOntem = transacoesOntem.reduce((acc, t) => acc + Number(t.valor), 0);
    const qtdOntem = transacoesOntem.length;
    const ticketMedioOntem = qtdOntem > 0 ? totalOntem / qtdOntem : 0;
    
    // Variações percentuais
    const variacaoValor = totalOntem > 0 ? ((totalHoje - totalOntem) / totalOntem) * 100 : 0;
    const variacaoQtd = qtdOntem > 0 ? ((qtdHoje - qtdOntem) / qtdOntem) * 100 : 0;
    const variacaoTicket = ticketMedioOntem > 0 ? ((ticketMedio - ticketMedioOntem) / ticketMedioOntem) * 100 : 0;
    
    return { 
      porHora, porFormaPgto, porFrentista, 
      totalHoje, qtdHoje, ticketMedio,
      totalOntem, qtdOntem, ticketMedioOntem,
      variacaoValor, variacaoQtd, variacaoTicket
    };
  }, [tefLogs]);

  return (
    <AdminLayout title="Frentista / Stone">
      {/* Indicador de Status Realtime */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${
          realtimeStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
          realtimeStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
          'bg-red-500'
        }`} />
        <span className="text-xs text-muted-foreground">
          {realtimeStatus === 'connected' ? '🔴 Ao vivo - Recebendo transações Stone automaticamente' : 
           realtimeStatus === 'connecting' ? 'Conectando...' : 
           'Desconectado'}
        </span>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="equipe" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="registro" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Registro TEF
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importar CSV
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hoje</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  R$ {dashboardData.totalHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {dashboardData.variacaoValor >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs font-medium ${dashboardData.variacaoValor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData.variacaoValor >= 0 ? '+' : ''}{dashboardData.variacaoValor.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs ontem</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transações</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.qtdHoje}</div>
                <div className="flex items-center gap-1 mt-1">
                  {dashboardData.variacaoQtd >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs font-medium ${dashboardData.variacaoQtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData.variacaoQtd >= 0 ? '+' : ''}{dashboardData.variacaoQtd.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">({dashboardData.qtdOntem} ontem)</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {dashboardData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {dashboardData.variacaoTicket >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`text-xs font-medium ${dashboardData.variacaoTicket >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dashboardData.variacaoTicket >= 0 ? '+' : ''}{dashboardData.variacaoTicket.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs ontem</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ontem</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">
                  R$ {dashboardData.totalOntem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData.qtdOntem} transações
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Gráfico de Área - Transações por Hora */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Transações por Hora (Últimas 12h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dashboardData.porHora}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hora" className="text-xs" />
                    <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                      labelFormatter={(label) => `Horário: ${label}`}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorValor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Pizza - Por Forma de Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Por Forma de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.porFormaPgto.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={dashboardData.porFormaPgto}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {dashboardData.porFormaPgto.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Nenhuma transação hoje
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Barras - Por Frentista */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Vendas por Frentista
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.porFrentista.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboardData.porFrentista.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} className="text-xs" />
                      <YAxis type="category" dataKey="nome" width={100} className="text-xs" />
                      <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Bar dataKey="valor" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Nenhuma transação hoje
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Últimas Transações em Tempo Real */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Últimas Transações (Tempo Real)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tefLogs.slice(0, 10).map((tef) => (
                  <div key={tef.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tef.forma_pagamento === 'credito' ? 'bg-blue-500/10 text-blue-600' :
                        tef.forma_pagamento === 'debito' ? 'bg-orange-500/10 text-orange-600' :
                        tef.forma_pagamento === 'pix' ? 'bg-purple-500/10 text-purple-600' :
                        'bg-gray-500/10 text-gray-600'
                      }`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{tef.frentista_nome || 'Não identificado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(tef.horario || tef.created_at), 'HH:mm:ss', { locale: ptBR })} • {tef.forma_pagamento}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">R$ {Number(tef.valor).toFixed(2)}</p>
                      {tef.checkin_id && (
                        <Badge variant="outline" className="text-xs">Vinculado</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {tefLogs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aguardando transações...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cadastro de Frentistas</h2>
              <Button onClick={() => {
                setEditingFrentista(null);
                setFrentistaForm({ codigo: '', nome: '', terminal_id: '' });
                setShowFrentistaDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Frentista
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frentistas.map((frentista) => (
                <Card key={frentista.id} className={!frentista.is_active ? 'opacity-60' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{frentista.nome}</p>
                          <p className="text-sm text-muted-foreground">Código: {frentista.codigo}</p>
                          {frentista.terminal_id && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CreditCard className="w-3 h-3" /> Terminal: {frentista.terminal_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={frentista.is_active ? 'default' : 'secondary'}>
                        {frentista.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Total atendimentos:</span>
                        <span className="font-semibold">{frentista.atendimentos || 0}</span>
                      </div>
                      
                      {frentista.meta ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Meta {getPeriodLabel(frentista.meta.period_type)}:</span>
                            </div>
                            <span className="font-semibold">
                              {frentista.periodCheckins}/{frentista.meta.target_checkins}
                            </span>
                          </div>
                          <div className="relative">
                            <Progress value={frentista.metaProgress} className="h-2" />
                            <div 
                              className={`absolute inset-0 h-2 rounded-full ${getProgressColor(frentista.metaProgress || 0)} transition-all`}
                              style={{ width: `${frentista.metaProgress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={frentista.metaProgress && frentista.metaProgress >= 100 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                              {frentista.metaProgress && frentista.metaProgress >= 100 ? '✓ Meta atingida!' : `${frentista.metaProgress}% concluído`}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs"
                              onClick={() => openMetaDialog(frentista)}
                            >
                              Editar meta
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => openMetaDialog(frentista)}
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Definir Meta
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => openEditFrentista(frentista)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm" 
                        onClick={() => {
                          setSelectedFrentistaForPin(frentista);
                          setShowPinDialog(true);
                        }}
                        title="Configurar PIN"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant={frentista.is_active ? 'destructive' : 'default'}
                        size="sm" 
                        onClick={() => toggleFrentistaStatus(frentista)}
                      >
                        {frentista.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {frentistas.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum frentista cadastrado.</p>
                    <p className="text-sm">Clique em "Novo Frentista" para começar.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Registro Tab */}
        <TabsContent value="registro">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Identificação do Frentista
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Código do Frentista *</Label>
                    <Input
                      placeholder="Ex: F001"
                      value={form.frentista_id}
                      onChange={(e) => setForm(f => ({ ...f, frentista_id: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div>
                    <Label>Nome</Label>
                    <Input
                      placeholder="Nome do frentista"
                      value={form.frentista_nome}
                      onChange={(e) => setForm(f => ({ ...f, frentista_nome: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Terminal ID</Label>
                  <Input
                    placeholder="Ex: STONE001"
                    value={form.terminal_id}
                    onChange={(e) => setForm(f => ({ ...f, terminal_id: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Dados da Transação TEF
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor (R$) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        className="pl-9"
                        value={form.valor}
                        onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Forma de Pagamento *</Label>
                    <Select value={form.forma_pagamento} onValueChange={(v) => setForm(f => ({ ...f, forma_pagamento: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debito">Débito</SelectItem>
                        <SelectItem value="credito">Crédito à Vista</SelectItem>
                        <SelectItem value="credito_parcelado">Crédito Parcelado</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="voucher">Voucher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>NSU</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Número único"
                        className="pl-9"
                        value={form.nsu}
                        onChange={(e) => setForm(f => ({ ...f, nsu: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Código Autorização</Label>
                    <Input
                      placeholder="Autorização"
                      value={form.autorizacao}
                      onChange={(e) => setForm(f => ({ ...f, autorizacao: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bandeira</Label>
                    <Select value={form.bandeira} onValueChange={(v) => setForm(f => ({ ...f, bandeira: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visa">Visa</SelectItem>
                        <SelectItem value="mastercard">Mastercard</SelectItem>
                        <SelectItem value="elo">Elo</SelectItem>
                        <SelectItem value="amex">American Express</SelectItem>
                        <SelectItem value="hipercard">Hipercard</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Parcelas</Label>
                    <Select value={form.parcelas} onValueChange={(v) => setForm(f => ({ ...f, parcelas: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSubmit} disabled={saving} className="w-full mt-4" size="lg">
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Registrar Transação</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent unlinked transactions */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transações Recentes Não Vinculadas</CardTitle>
                <CardDescription>Vincule transações TEF aos abastecimentos</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchTefLogs}>
                <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead>Frentista</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>NSU</TableHead>
                    <TableHead>Bandeira</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tefLogs.filter(t => !t.checkin_id).slice(0, 10).map(tef => (
                    <TableRow key={tef.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(tef.horario), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tef.frentista_id}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold">
                        R$ {Number(tef.valor).toFixed(2)}
                      </TableCell>
                      <TableCell className="capitalize">{tef.forma_pagamento}</TableCell>
                      <TableCell className="font-mono">{tef.nsu || '-'}</TableCell>
                      <TableCell>
                        {tef.bandeira && (
                          <Badge className={`${getBandeiraBadge(tef.bandeira)} text-white`}>
                            {tef.bandeira}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tef.status === 'aprovado' ? 'default' : 'destructive'}>
                          {tef.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openLinkDialog(tef)}>
                          <Link2 className="w-4 h-4 mr-1" /> Vincular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tefLogs.filter(t => !t.checkin_id).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhuma transação pendente de vínculo
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Importar CSV Tab */}
        <TabsContent value="importar">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Importar CSV Stone
                </CardTitle>
                <CardDescription>
                  Importe transações TEF diretamente do relatório Stone
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Arraste ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Formato: CSV com colunas de transações Stone
                  </p>
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={importing}
                    size="lg"
                  >
                    {importing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Selecionar Arquivo</>
                    )}
                  </Button>
                </div>

                {importing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processando...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} />
                  </div>
                )}

                {importResult && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{importResult.total}</p>
                          <p className="text-xs text-muted-foreground">Total linhas</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                          <p className="text-xs text-muted-foreground">Importados</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">{importResult.linked}</p>
                          <p className="text-xs text-muted-foreground">Vinculados</p>
                        </div>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="mt-4 p-3 bg-destructive/10 rounded text-sm">
                          <p className="font-medium text-destructive flex items-center gap-1 mb-2">
                            <AlertCircle className="w-4 h-4" />
                            {importResult.errors.length} erro(s):
                          </p>
                          <ul className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                            {importResult.errors.slice(0, 5).map((e, i) => (
                              <li key={i}>• {e}</li>
                            ))}
                            {importResult.errors.length > 5 && (
                              <li>... e mais {importResult.errors.length - 5}</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formato Esperado do CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg font-mono text-xs overflow-x-auto">
                  <p className="font-semibold mb-2">Colunas aceitas:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />data, horario, hora</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />valor, value, amount</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />forma, pagamento, tipo</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />nsu</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />autorizacao, auth</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />bandeira, brand</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />parcelas, installments</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />terminal, pos, maquina</li>
                    <li><CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />frentista, operador</li>
                  </ul>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Vinculação automática:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Transações são vinculadas automaticamente a check-ins</li>
                    <li>Critério: mesmo valor e horário dentro de 30 min</li>
                    <li>Check-ins sem vínculo podem ser vinculados manualmente</li>
                  </ul>
                </div>

                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">Dica:</p>
                  <p className="text-muted-foreground">
                    Exporte o relatório de transações do portal Stone em formato CSV para importar aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Histórico Tab */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de Transações TEF</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchTefLogs}>
                <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Frentista</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>NSU</TableHead>
                      <TableHead>Bandeira</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Vinculado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tefLogs.map(tef => (
                      <TableRow key={tef.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(tef.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Badge variant="outline">{tef.frentista_id}</Badge>
                            {tef.frentista_nome && (
                              <span className="text-xs text-muted-foreground">{tef.frentista_nome}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold">
                          R$ {Number(tef.valor).toFixed(2)}
                        </TableCell>
                        <TableCell className="capitalize">{tef.forma_pagamento}</TableCell>
                        <TableCell className="font-mono">{tef.nsu || '-'}</TableCell>
                        <TableCell>
                          {tef.bandeira && (
                            <Badge className={`${getBandeiraBadge(tef.bandeira)} text-white`}>
                              {tef.bandeira}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{tef.parcelas}x</TableCell>
                        <TableCell>
                          {tef.checkin_id ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Sim
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Transação ao Abastecimento</DialogTitle>
          </DialogHeader>
          
          {selectedTef && (
            <div className="p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex items-center gap-4">
                <CreditCard className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-bold">R$ {Number(selectedTef.valor).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTef.forma_pagamento} • NSU: {selectedTef.nsu || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-2">
              Selecione o abastecimento da última hora para vincular:
            </p>
            {recentCheckins.map(checkin => (
              <button
                key={checkin.id}
                onClick={() => linkToCheckin(checkin.id)}
                className="w-full p-3 rounded-lg border hover:bg-accent/50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Fuel className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{checkin.customers?.name || checkin.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(checkin.created_at), 'HH:mm', { locale: ptBR })} • 
                      {checkin.amount ? ` R$ ${checkin.amount}` : ' Valor não informado'}
                    </p>
                  </div>
                </div>
                <Link2 className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
            {recentCheckins.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum abastecimento recente disponível
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Frentista Dialog */}
      <Dialog open={showFrentistaDialog} onOpenChange={setShowFrentistaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFrentista ? 'Editar Frentista' : 'Novo Frentista'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Código *</Label>
              <Input
                placeholder="Ex: 001"
                value={frentistaForm.codigo}
                onChange={(e) => setFrentistaForm(f => ({ ...f, codigo: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este código será usado no QR Code do frentista
              </p>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Nome do frentista"
                value={frentistaForm.nome}
                onChange={(e) => setFrentistaForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Terminal Stone (Nº Série)</Label>
              <Input
                placeholder="Ex: 12345678"
                value={frentistaForm.terminal_id}
                onChange={(e) => setFrentistaForm(f => ({ ...f, terminal_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número de série da máquina Stone vinculada a este frentista
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFrentistaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveFrentista} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meta Dialog */}
      <Dialog open={showMetaDialog} onOpenChange={setShowMetaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Definir Meta - {selectedFrentistaForMeta?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Período da Meta</Label>
              <Select 
                value={metaForm.period_type} 
                onValueChange={(v: 'daily' | 'weekly' | 'monthly') => setMetaForm(f => ({ ...f, period_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                A meta será calculada automaticamente para o período selecionado
              </p>
            </div>
            
            <div>
              <Label>Meta de Atendimentos *</Label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="50"
                  className="pl-9"
                  value={metaForm.target_checkins}
                  onChange={(e) => setMetaForm(f => ({ ...f, target_checkins: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Quantidade de atendimentos esperados no período
              </p>
            </div>
            
            <div>
              <Label>Meta de Valor (opcional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="pl-9"
                  value={metaForm.target_amount}
                  onChange={(e) => setMetaForm(f => ({ ...f, target_amount: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Valor total em vendas esperado (opcional)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMetaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveMeta} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <FrentistaPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        frentista={selectedFrentistaForPin}
        onSuccess={fetchFrentistas}
      />
    </AdminLayout>
  );
}
