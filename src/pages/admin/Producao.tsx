import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, DollarSign, Droplets, Clock, AlertTriangle, Play, Award, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminProducao() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    daily: { checkins: 0, amount: 0, liters: 0 },
    weekly: { checkins: 0, amount: 0, liters: 0 },
    monthly: { checkins: 0, amount: 0, liters: 0 },
    complaints: 0,
    ranking: [] as { code: string; count: number; amount: number; liters: number }[],
    isDemo: false
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [dailyRes, weeklyRes, monthlyRes, complaintsRes] = await Promise.all([
      supabase.from('checkins').select('id, amount, liters, is_demo, attendant_code').gte('created_at', today.toISOString()),
      supabase.from('checkins').select('id, amount, liters, is_demo').gte('created_at', weekAgo.toISOString()),
      supabase.from('checkins').select('id, amount, liters, is_demo').gte('created_at', monthAgo.toISOString()),
      supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
    ]);

    const dailyData = dailyRes.data || [];
    const weeklyData = weeklyRes.data || [];
    const monthlyData = monthlyRes.data || [];

    // Demo check
    const hasRealData = dailyData.some(d => !d.is_demo);
    const isDemo = !hasRealData && dailyData.some(d => d.is_demo);

    // Attendant ranking
    const attendantMap: Record<string, { count: number; amount: number; liters: number }> = {};
    dailyData.forEach(d => {
      if (d.attendant_code) {
        if (!attendantMap[d.attendant_code]) {
          attendantMap[d.attendant_code] = { count: 0, amount: 0, liters: 0 };
        }
        attendantMap[d.attendant_code].count++;
        attendantMap[d.attendant_code].amount += d.amount || 0;
        attendantMap[d.attendant_code].liters += d.liters || 0;
      }
    });

    const ranking = Object.entries(attendantMap)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({
      daily: {
        checkins: dailyData.length,
        amount: dailyData.reduce((sum, d) => sum + (d.amount || 0), 0),
        liters: dailyData.reduce((sum, d) => sum + (d.liters || 0), 0)
      },
      weekly: {
        checkins: weeklyData.length,
        amount: weeklyData.reduce((sum, d) => sum + (d.amount || 0), 0),
        liters: weeklyData.reduce((sum, d) => sum + (d.liters || 0), 0)
      },
      monthly: {
        checkins: monthlyData.length,
        amount: monthlyData.reduce((sum, d) => sum + (d.amount || 0), 0),
        liters: monthlyData.reduce((sum, d) => sum + (d.liters || 0), 0)
      },
      complaints: complaintsRes.count || 0,
      ranking,
      isDemo
    });
    setLoading(false);
  };

  return (
    <AdminLayout title="Produção">
      <div className="space-y-6">
        {/* Demo Button */}
        <div className="flex justify-end">
          <Button onClick={() => navigate('/admin/manual')}>
            <Play className="mr-2 h-4 w-4" />
            VER DEMONSTRAÇÃO
          </Button>
        </div>

        {/* Demo Badge */}
        {stats.isDemo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400 font-medium">
              🎭 Modo Demonstração - Exibindo dados fictícios
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <>
            {/* Daily Stats */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hoje
              </h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins</CardTitle>
                    <Users className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{stats.daily.checkins}</div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      R$ {stats.daily.amount.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Litros</CardTitle>
                    <Droplets className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {stats.daily.liters.toFixed(1)} L
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Reclamações</CardTitle>
                    <Badge variant="secondary" className="text-xs">Novas</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-500">{stats.complaints}</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Period Comparison */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Última Semana
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Check-ins</span>
                    <span className="font-semibold">{stats.weekly.checkins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Faturamento</span>
                    <span className="font-semibold text-green-600">R$ {stats.weekly.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Litros</span>
                    <span className="font-semibold text-blue-600">{stats.weekly.liters.toFixed(1)} L</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Último Mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Check-ins</span>
                    <span className="font-semibold">{stats.monthly.checkins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Faturamento</span>
                    <span className="font-semibold text-green-600">R$ {stats.monthly.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Litros</span>
                    <span className="font-semibold text-blue-600">{stats.monthly.liters.toFixed(1)} L</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendant Ranking */}
            {stats.ranking.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Ranking Frentistas (Hoje)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.ranking.map((item, index) => (
                      <div 
                        key={item.code} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                            ${index === 0 ? 'bg-yellow-500 text-yellow-900' : 
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              index === 2 ? 'bg-orange-400 text-orange-900' :
                              'bg-muted text-muted-foreground'}
                          `}>
                            {index + 1}
                          </div>
                          <span className="font-medium">{item.code}</span>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <span className="text-muted-foreground">
                            {item.count} check-ins
                          </span>
                          <span className="text-green-600 font-medium">
                            R$ {item.amount.toFixed(2)}
                          </span>
                          <span className="text-blue-600 font-medium">
                            {item.liters.toFixed(1)} L
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
