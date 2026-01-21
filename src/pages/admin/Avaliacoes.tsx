import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Download,
  RefreshCw,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RatingData {
  id: string;
  message: string;
  phone: string | null;
  created_at: string;
  rating: number;
}

interface DailyStats {
  date: string;
  count: number;
  average: number;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

export default function AdminAvaliacoes() {
  const [ratings, setRatings] = useState<RatingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    fetchRatings();
  }, [period]);

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), period);
      
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .like('message', 'Avaliação:%')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse ratings from message
      const parsedRatings = (data || []).map(item => {
        const match = item.message.match(/Avaliação: (\d) estrelas/);
        return {
          ...item,
          rating: match ? parseInt(match[1]) : 0
        };
      }).filter(item => item.rating > 0);

      setRatings(parsedRatings);
    } catch (error) {
      console.error('Erro ao buscar avaliações:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalRatings = ratings.length;
  const averageRating = totalRatings > 0 
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings).toFixed(1)
    : '0.0';
  
  // Rating distribution
  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    name: `${star} ★`,
    value: ratings.filter(r => r.rating === star).length,
    star
  }));

  // Satisfaction breakdown
  const satisfied = ratings.filter(r => r.rating >= 4).length;
  const neutral = ratings.filter(r => r.rating === 3).length;
  const dissatisfied = ratings.filter(r => r.rating <= 2).length;

  const satisfactionData = [
    { name: 'Satisfeitos', value: satisfied, color: '#22c55e' },
    { name: 'Neutros', value: neutral, color: '#eab308' },
    { name: 'Insatisfeitos', value: dissatisfied, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // Daily stats for line chart
  const dailyStats: DailyStats[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayRatings = ratings.filter(r => {
      const rDate = new Date(r.created_at);
      return rDate >= dayStart && rDate <= dayEnd;
    });

    if (dayRatings.length > 0) {
      dailyStats.push({
        date: format(date, 'dd/MM', { locale: ptBR }),
        count: dayRatings.length,
        average: dayRatings.reduce((sum, r) => sum + r.rating, 0) / dayRatings.length
      });
    }
  }

  const exportCSV = () => {
    const headers = ['Data', 'Telefone', 'Avaliação'];
    const rows = ratings.map(r => [
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      r.phone || 'N/A',
      `${r.rating} estrelas`
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const NPS = totalRatings > 0 
    ? Math.round(((satisfied - dissatisfied) / totalRatings) * 100)
    : 0;

  return (
    <AdminLayout title="Dashboard de Avaliações">
      <div className="space-y-6">
        {/* Period selector and actions */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            {[7, 30, 90].map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p as 7 | 30 | 90)}
              >
                <Calendar className="w-4 h-4 mr-1" />
                {p} dias
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRatings} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={totalRatings === 0}>
              <Download className="w-4 h-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Avaliações</p>
                  <p className="text-3xl font-bold">{totalRatings}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Média Geral</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold">{averageRating}</p>
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">NPS Score</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold">{NPS}</p>
                    {NPS > 0 ? (
                      <TrendingUp className="w-5 h-5 text-success" />
                    ) : NPS < 0 ? (
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    ) : (
                      <Minus className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  NPS >= 50 ? 'bg-success/10' : NPS >= 0 ? 'bg-yellow-500/10' : 'bg-destructive/10'
                }`}>
                  {NPS >= 50 ? (
                    <ThumbsUp className="w-6 h-6 text-success" />
                  ) : NPS >= 0 ? (
                    <Minus className="w-6 h-6 text-yellow-500" />
                  ) : (
                    <ThumbsDown className="w-6 h-6 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Satisfação</p>
                  <p className="text-3xl font-bold">
                    {totalRatings > 0 ? Math.round((satisfied / totalRatings) * 100) : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <ThumbsUp className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                <Badge variant="outline" className="text-success border-success/30">
                  {satisfied} satisfeitos
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Rating Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição de Notas</CardTitle>
            </CardHeader>
            <CardContent>
              {totalRatings > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ratingDistribution} layout="vertical">
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={50} />
                    <Tooltip 
                      formatter={(value: number) => [`${value} avaliações`, 'Quantidade']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhuma avaliação no período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Satisfaction Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Satisfação Geral</CardTitle>
            </CardHeader>
            <CardContent>
              {totalRatings > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={satisfactionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {satisfactionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} avaliações`, 'Quantidade']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhuma avaliação no período
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trend Line */}
        {dailyStats.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução da Média</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'average' ? value.toFixed(1) : value,
                      name === 'average' ? 'Média' : 'Quantidade'
                    ]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="average" 
                    name="Média" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    name="Quantidade" 
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--secondary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Ratings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avaliações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {ratings.length > 0 ? (
              <div className="space-y-3">
                {ratings.slice(0, 10).map((rating) => (
                  <div 
                    key={rating.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= rating.rating 
                                ? 'text-yellow-400 fill-yellow-400' 
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {rating.phone ? `****${rating.phone.slice(-4)}` : 'Anônimo'}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(rating.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma avaliação encontrada no período selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
