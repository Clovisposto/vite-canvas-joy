import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  RefreshCw,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  BellOff,
  Phone,
  Save,
  Loader2,
  MessageSquare,
  Copy,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppLog {
  id: string;
  phone: string;
  status: string;
  message: string;
  error: string | null;
  created_at: string;
  provider: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  queued: number;
  successRate: number;
  failureRate: number;
}

interface AlertSettings {
  phone: string;
  threshold: number;
  cooldown: number;
}

interface ConnectionStatus {
  online: boolean;
  error: string | null;
  step: string | null;
  baseUrl: string | null;
  instance: string | null;
  offlineReason: string | null;
  lastCheck: Date;
  retrying: boolean;
}

const DEFAULT_THRESHOLD = 20;
const DEFAULT_COOLDOWN = 5;
const POLL_INTERVAL = 30000; // 30 seconds
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export default function WhatsAppStatusDashboard() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, queued: 0, successRate: 0, failureRate: 0 });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    online: false,
    error: null,
    step: null,
    baseUrl: null,
    instance: null,
    offlineReason: null,
    lastCheck: new Date(),
    retrying: false,
  });
  const [healthStatus, setHealthStatus] = useState<'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'>('UNKNOWN');
  const [loading, setLoading] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({ phone: '', threshold: DEFAULT_THRESHOLD, cooldown: DEFAULT_COOLDOWN });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  
  const lastAlertTime = useRef<number>(0);
  const lastHealthSaved = useRef<'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'>('UNKNOWN');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      setLogs(data || []);
      calculateStats(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (logData: WhatsAppLog[]) => {
    const total = logData.length;
    const sent = logData.filter(l => l.status === 'SENT').length;
    const failed = logData.filter(l => l.status === 'FAILED').length;
    const queued = logData.filter(l => l.status === 'QUEUED').length;
    const completedTotal = sent + failed;
    const successRate = completedTotal > 0 ? Math.round((sent / completedTotal) * 100) : 0;
    const failureRate = completedTotal > 0 ? Math.round((failed / completedTotal) * 100) : 0;

    const newStats = { total, sent, failed, queued, successRate, failureRate };
    setStats(newStats);
    checkFailureAlert(newStats);
  };

  const checkFailureAlert = async (currentStats: Stats) => {
    const now = Date.now();
    const timeSinceLastAlert = now - lastAlertTime.current;
    const threshold = alertSettings.threshold || DEFAULT_THRESHOLD;
    
    if (
      alertsEnabled &&
      (currentStats.sent + currentStats.failed) >= 5 &&
      currentStats.failureRate > threshold &&
      timeSinceLastAlert > ALERT_COOLDOWN_MS
    ) {
      await triggerFailureAlert(currentStats);
    } else if (currentStats.failureRate <= threshold) {
      setAlertTriggered(false);
    }
  };

  const triggerFailureAlert = async (currentStats: Stats) => {
    lastAlertTime.current = Date.now();
    setAlertTriggered(true);

    toast({
      title: '⚠️ Alerta: Alta taxa de falhas',
      description: `${currentStats.failureRate}% das mensagens falharam nas últimas 24h.`,
      variant: 'destructive',
      duration: 10000,
    });

    if (alertSettings.phone) {
      await sendWhatsAppAlert(currentStats);
    }
  };

  const sendWhatsAppAlert = async (currentStats: Stats) => {
    setSendingAlert(true);
    try {
      const message = `🚨 *ALERTA DO SISTEMA*\n\nAlta taxa de falhas no WhatsApp.\n\n📊 *Estatísticas (24h):*\n• Taxa de falha: ${currentStats.failureRate}%\n• Enviadas: ${currentStats.sent}\n• Falhas: ${currentStats.failed}\n• Total: ${currentStats.total}\n\n⚠️ Verifique a conexão.`;

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { to: alertSettings.phone, message },
      });

      if (error || !data?.ok) {
        console.error('Failed to send alert:', error || data?.error);
      } else {
        toast({ title: 'Alerta enviado', description: `Para ${alertSettings.phone}` });
      }
    } catch (err) {
      console.error('Error sending alert:', err);
    } finally {
      setSendingAlert(false);
    }
  };

  const fetchAlertSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['alert_phone', 'alert_threshold', 'alert_cooldown']);

      if (data) {
        const settings: AlertSettings = { phone: '', threshold: DEFAULT_THRESHOLD, cooldown: DEFAULT_COOLDOWN };
        data.forEach((s) => {
          const value = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
          if (s.key === 'alert_phone') settings.phone = value || '';
          if (s.key === 'alert_threshold') settings.threshold = parseInt(value) || DEFAULT_THRESHOLD;
          if (s.key === 'alert_cooldown') settings.cooldown = parseInt(value) || DEFAULT_COOLDOWN;
        });
        setAlertSettings(settings);
      }
    } catch (err) {
      console.error('Error fetching alert settings:', err);
    }
  };

  const saveAlertSettings = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        supabase.from('settings').upsert({ key: 'alert_phone', value: JSON.stringify(alertSettings.phone) }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'alert_threshold', value: JSON.stringify(alertSettings.threshold.toString()) }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'alert_cooldown', value: JSON.stringify(alertSettings.cooldown.toString()) }, { onConflict: 'key' }),
      ]);
      toast({ title: 'Configurações de alerta salvas!' });
    } catch (err) {
      console.error('Error saving alert settings:', err);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  const checkConnection = useCallback(async (isManual = false) => {
    if (isManual) {
      setConnectionStatus(prev => ({ ...prev, retrying: true }));
    }

    try {
      const { data } = await supabase.functions.invoke('whatsapp-test', {
        body: { provider: 'EVOLUTION' },
      });

      const result = data || {};
      const details = result?.details || {};
      const connected = result.ok === true && details?.connected === true;
      const baseUrl = result?.url || details?.baseUrl || details?.url || null;
      const instanceName = result?.instance || details?.instance || null;
      const offlineReason = details?.offlineReason || null;

      setConnectionStatus({
        online: connected,
        error: result.ok ? null : (result.error || 'Erro desconhecido'),
        step: result.step || null,
        baseUrl: typeof baseUrl === 'string' ? baseUrl : null,
        instance: typeof instanceName === 'string' ? instanceName : null,
        offlineReason: typeof offlineReason === 'string' ? offlineReason : null,
        lastCheck: new Date(),
        retrying: false,
      });

      const newHealth: 'HEALTHY' | 'UNHEALTHY' = connected ? 'HEALTHY' : 'UNHEALTHY';
      setHealthStatus(newHealth);
      setShowOfflineBanner(!connected);

      if (lastHealthSaved.current !== newHealth) {
        lastHealthSaved.current = newHealth;
        await supabase
          .from('settings')
          .upsert({ key: 'whatsapp_health', value: JSON.stringify(newHealth) }, { onConflict: 'key' });
      }

      if (isManual) {
        toast({
          title: connected ? '✅ Conectado!' : '❌ Offline',
          description: connected ? 'API Evolution respondendo normalmente.' : (result.error || 'Verifique as configurações.'),
          variant: connected ? 'default' : 'destructive',
        });
      }
    } catch (err) {
      console.error('Connection check error:', err);
      setConnectionStatus(prev => ({
        ...prev,
        online: false,
        error: 'Erro ao verificar conexão',
        retrying: false,
        lastCheck: new Date(),
      }));
      setHealthStatus('UNHEALTHY');
      setShowOfflineBanner(true);
    }
  }, [toast]);

  const copyBaseUrl = () => {
    if (connectionStatus.baseUrl) {
      navigator.clipboard.writeText(connectionStatus.baseUrl);
      toast({ title: 'URL copiada!' });
    }
  };

  useEffect(() => {
    fetchLogs();
    checkConnection();
    fetchAlertSettings();

    // Realtime subscription
    const channel = supabase
      .channel('whatsapp-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    // Polling every 30s
    pollIntervalRef.current = setInterval(() => checkConnection(), POLL_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchLogs, checkConnection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'bg-green-500/20 text-green-600 border-green-500/30';
      case 'FAILED': return 'bg-red-500/20 text-red-600 border-red-500/30';
      case 'QUEUED': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return <CheckCircle2 className="w-3 h-3" />;
      case 'FAILED': return <XCircle className="w-3 h-3" />;
      case 'QUEUED': return <Clock className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4" />
            Status da Integração WhatsApp
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlertConfig(!showAlertConfig)}
              title="Configurar alertas"
              className={showAlertConfig ? 'text-primary bg-primary/10' : 'text-muted-foreground'}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              title={alertsEnabled ? 'Desativar alertas' : 'Ativar alertas'}
              className={alertsEnabled ? 'text-primary' : 'text-muted-foreground'}
            >
              {alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Badge 
              variant="outline" 
              className={connectionStatus.online 
                ? 'bg-green-500/10 text-green-600 border-green-500/30' 
                : 'bg-red-500/10 text-red-600 border-red-500/30'
              }
            >
              {connectionStatus.online ? (
                <><Wifi className="w-3 h-3 mr-1" /> Online</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
              )}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { fetchLogs(); checkConnection(true); }}
              disabled={loading || connectionStatus.retrying}
            >
              <RefreshCw className={`w-4 h-4 ${(loading || connectionStatus.retrying) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Última verificação: {formatDistanceToNow(connectionStatus.lastCheck, { addSuffix: true, locale: ptBR })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Offline Banner with Actions */}
        {showOfflineBanner && !connectionStatus.online && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
            <div className="flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  API Evolution Offline
                </p>
                <p className="text-xs text-red-600/80 mt-1 break-words">
                  {connectionStatus.error || 'Não foi possível conectar ao servidor.'}
                </p>
                {connectionStatus.offlineReason && (
                  <p className="text-xs text-red-600/60 mt-1">
                    Motivo: <code className="bg-red-500/10 px-1 rounded font-mono">{connectionStatus.offlineReason}</code>
                  </p>
                )}
                {connectionStatus.step && (
                  <p className="text-xs text-red-600/60 mt-1">
                    Etapa: <code className="bg-red-500/10 px-1 rounded">{connectionStatus.step}</code>
                  </p>
                )}
                {(connectionStatus.baseUrl || connectionStatus.instance) && (
                  <div className="text-xs text-red-600/60 mt-2 space-y-1 font-mono">
                    {connectionStatus.baseUrl && (
                      <p className="break-all">URL: {connectionStatus.baseUrl}</p>
                    )}
                    {connectionStatus.instance && (
                      <p>Instância: {connectionStatus.instance}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {connectionStatus.baseUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBaseUrl}
                  className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar URL
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkConnection(true)}
                disabled={connectionStatus.retrying}
                className="border-red-500/30 text-red-600 hover:bg-red-500/10"
              >
                {connectionStatus.retrying ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Testando...</>
                ) : (
                  <><RotateCcw className="w-3 h-3 mr-1" />Re-testar</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/admin/configuracoes'}
                className="border-red-500/30 text-red-600 hover:bg-red-500/10"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Abrir Configurações
              </Button>
            </div>
          </div>
        )}

        {/* Alert Configuration Panel */}
        {showAlertConfig && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-medium">Configurar Alertas via WhatsApp</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="alert-phone" className="text-xs">Telefone para alertas</Label>
                <Input
                  id="alert-phone"
                  placeholder="5511999999999"
                  value={alertSettings.phone}
                  onChange={(e) => setAlertSettings(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">Com código do país (55)</p>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="alert-threshold" className="text-xs">Limite de falha (%)</Label>
                <Input
                  id="alert-threshold"
                  type="number"
                  min={1}
                  max={100}
                  value={alertSettings.threshold}
                  onChange={(e) => setAlertSettings(prev => ({ ...prev, threshold: parseInt(e.target.value) || DEFAULT_THRESHOLD }))}
                  className="h-9 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="alert-cooldown" className="text-xs">Intervalo (minutos)</Label>
                <Input
                  id="alert-cooldown"
                  type="number"
                  min={1}
                  max={60}
                  value={alertSettings.cooldown}
                  onChange={(e) => setAlertSettings(prev => ({ ...prev, cooldown: parseInt(e.target.value) || DEFAULT_COOLDOWN }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAlertConfig(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveAlertSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Alert Banner */}
        {alertTriggered && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Alta taxa de falhas detectada {sendingAlert && '(enviando alerta...)'}
              </p>
              <p className="text-xs text-red-600/80">
                {stats.failureRate}% das mensagens falharam. Verifique a conexão com a API.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAlertTriggered(false)}
              className="border-red-500/30 text-red-600 hover:bg-red-500/10"
            >
              Dispensar
            </Button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total (24h)</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-5 h-5" />
              {stats.sent}
            </div>
            <div className="text-xs text-green-600/80">Enviados</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 text-center">
            <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
              <XCircle className="w-5 h-5" />
              {stats.failed}
            </div>
            <div className="text-xs text-red-600/80">Falhas</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
              stats.successRate >= 80 ? 'text-green-600' : 
              stats.successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.successRate >= 80 ? <TrendingUp className="w-5 h-5" /> : 
               stats.successRate >= 50 ? <AlertTriangle className="w-5 h-5" /> : 
               <TrendingDown className="w-5 h-5" />}
              {stats.successRate}%
            </div>
            <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
          </div>
        </div>

        {/* Recent Activity - Full Phone and Error */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Atividade Recente
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma atividade nas últimas 24 horas
              </p>
            ) : (
              logs.slice(0, 15).map((log) => (
                <div 
                  key={log.id} 
                  className="p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`${getStatusColor(log.status)} flex-shrink-0`}>
                        {getStatusIcon(log.status)}
                        <span className="ml-1">{log.status}</span>
                      </Badge>
                      <span className="text-sm font-mono font-medium">{log.phone}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(log.created_at), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                  {log.error && (
                    <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded break-words">
                      {log.error}
                    </p>
                  )}
                  {log.message && (
                    <p className="text-xs text-muted-foreground truncate" title={log.message}>
                      {log.message.slice(0, 100)}{log.message.length > 100 ? '...' : ''}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Health Indicator */}
        {stats.total > 0 && (
          <div className={`p-3 rounded-lg border ${
            stats.successRate >= 80 
              ? 'bg-green-500/5 border-green-500/20' 
              : stats.successRate >= 50 
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {stats.successRate >= 80 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Sistema funcionando normalmente
                  </span>
                </>
              ) : stats.successRate >= 50 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">
                    Algumas mensagens estão falhando. Verifique as configurações.
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700 dark:text-red-400">
                    Alta taxa de falhas. Verifique a conexão com a API.
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
