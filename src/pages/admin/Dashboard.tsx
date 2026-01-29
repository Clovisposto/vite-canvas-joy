import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, CheckCircle, Gift, MessageSquare, TrendingUp, Play, QrCode, ExternalLink, AlertTriangle, Settings, MapPin, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';

interface CapturePointStats {
  tag: string;
  name: string;
  location: string | null;
  count: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    todayCheckins: 0,
    activePromos: 0,
    pendingComplaints: 0,
    isDemo: false,
  });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Fetch capture points stats
  const { data: captureStats, isLoading: captureStatsLoading } = useQuery({
    queryKey: ['capture-points-stats'],
    queryFn: async () => {
      // Get capture points
      const { data: points } = await supabase
        .from('qr_capture_points')
        .select('tag, name, location')
        .eq('is_active', true);

      // Get today's checkins grouped by tag
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: checkins } = await supabase
        .from('checkins')
        .select('tag')
        .gte('created_at', today.toISOString())
        .eq('is_demo', false);

      // Count checkins per tag
      const tagCounts: Record<string, number> = {};
      checkins?.forEach(c => {
        const tag = c.tag || 'sem_tag';
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Build stats array
      const statsArray: CapturePointStats[] = [];
      
      // Add known capture points
      points?.forEach(point => {
        statsArray.push({
          tag: point.tag,
          name: point.name,
          location: point.location,
          count: tagCounts[point.tag] || 0,
        });
        delete tagCounts[point.tag];
      });

      // Add any remaining tags not in capture points
      Object.entries(tagCounts).forEach(([tag, count]) => {
        if (tag !== 'sem_tag') {
          statsArray.push({
            tag,
            name: tag,
            location: null,
            count,
          });
        }
      });

      // Add "sem tag" if exists
      if (tagCounts['sem_tag']) {
        statsArray.push({
          tag: 'sem_tag',
          name: 'Sem identificação',
          location: null,
          count: tagCounts['sem_tag'],
        });
      }

      // Sort by count descending
      statsArray.sort((a, b) => b.count - a.count);

      return statsArray;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['whatsapp_number', 'posto_name', 'posto_phone']);
    
    const settingsMap: Record<string, string> = {};
    data?.forEach(s => {
      settingsMap[s.key] = typeof s.value === 'string' ? s.value.replace(/"/g, '') : JSON.stringify(s.value).replace(/"/g, '');
    });
    setSettings(settingsMap);
  };

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [contacts, checkins, promos, complaints, demoCheckins] = await Promise.all([
        supabase.from('wa_contacts').select('id', { count: 'exact', head: true }),
        supabase.from('checkins').select('id, is_demo', { count: 'exact' }).gte('created_at', today.toISOString()),
        supabase.from('promotions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
        supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('is_demo', true),
      ]);

      const realCheckins = checkins.data?.filter(c => !c.is_demo).length || 0;
      const hasRealData = realCheckins > 0;

      setStats({
        totalCustomers: contacts.count || 0,
        todayCheckins: hasRealData ? realCheckins : (checkins.count || 0),
        activePromos: promos.count || 0,
        pendingComplaints: complaints.count || 0,
        isDemo: !hasRealData && (demoCheckins.count || 0) > 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/aplicativo` : '/aplicativo';

  const totalCaptureCheckins = captureStats?.reduce((sum, s) => sum + s.count, 0) || 0;
  const maxCaptureCount = Math.max(...(captureStats?.map(s => s.count) || [1]), 1);

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Demo Button */}
        <div className="flex justify-end">
          <Button 
            size="lg" 
            onClick={() => navigate('/admin/manual')}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Play className="mr-2 h-5 w-5" />
            VER DEMONSTRAÇÃO DO SISTEMA
          </Button>
        </div>

        {/* Demo Badge */}
        {stats.isDemo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400 font-medium">
              🎭 Modo Demonstração - Os dados exibidos são fictícios
            </span>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins Hoje</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayCheckins}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Promoções Ativas</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePromos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingComplaints}</div>
            </CardContent>
          </Card>
        </div>

        {/* Capture Points Stats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Capturas por Ponto (Hoje)
            </CardTitle>
            <Link to="/admin/pontos-captura">
              <Button variant="ghost" size="sm">
                Gerenciar pontos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {captureStatsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : captureStats && captureStats.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>Total de capturas hoje: <strong className="text-foreground">{totalCaptureCheckins}</strong></span>
                </div>
                <div className="space-y-3">
                  {captureStats.map((stat) => (
                    <div key={stat.tag} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stat.name}</span>
                          {stat.location && (
                            <span className="text-xs text-muted-foreground">({stat.location})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            {stat.count}
                          </Badge>
                          {totalCaptureCheckins > 0 && (
                            <span className="text-xs text-muted-foreground w-12 text-right">
                              {Math.round((stat.count / totalCaptureCheckins) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Progress 
                        value={(stat.count / maxCaptureCount) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma captura registrada hoje</p>
                <p className="text-sm mt-1">As estatísticas aparecerão quando houver check-ins</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code & Status */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code do Aplicativo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={appUrl} size={180} />
              </div>
              <p className="text-sm text-muted-foreground text-center break-all">
                {appUrl}
              </p>
              <div className="flex gap-2 w-full">
                <Link to="/admin/qrcode" className="flex-1">
                  <Button className="w-full" variant="outline">
                    <QrCode className="w-4 h-4 mr-2" />
                    Personalizar
                  </Button>
                </Link>
                <a href={appUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir App
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Status do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Sorteio Automático</span>
                <Badge variant="default" className="bg-green-500">Ativo</Badge>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">WhatsApp Integrado</span>
                <Badge variant="secondary">Modo Assistido</Badge>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Telefone do Posto</span>
                <span className="text-sm font-mono text-primary">
                  {settings.posto_phone || settings.whatsapp_number || '55949155011'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Importação CSV</span>
                <Badge variant="secondary">Disponível</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/admin/sorteios">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <Gift className="h-6 w-6 mb-2" />
                  Sorteios
                </Button>
              </Link>
              <Link to="/admin/promocoes">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <TrendingUp className="h-6 w-6 mb-2" />
                  Promoções
                </Button>
              </Link>
              <Link to="/admin/captura">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <Users className="h-6 w-6 mb-2" />
                  Captura
                </Button>
              </Link>
              <Link to="/admin/atendimento">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <MessageSquare className="h-6 w-6 mb-2" />
                  Atendimento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
