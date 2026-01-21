import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  Calendar, 
  Download, 
  RefreshCw, 
  TrendingUp,
  Clock,
  User,
  Fuel,
  Trophy,
  Target
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
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Frentista {
  id: string;
  codigo: string;
  nome: string;
  is_active: boolean;
}

interface CheckinData {
  id: string;
  phone: string;
  attendant_code: string | null;
  created_at: string;
  origin: string | null;
}

interface FrentistaStats {
  codigo: string;
  nome: string;
  total: number;
  media_diaria: number;
  ultimo_atendimento: string | null;
  porcentagem: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(142 71% 45%)', 'hsl(280 65% 60%)', 'hsl(200 80% 50%)', 'hsl(38 92% 50%)'];

export default function RelatorioFrentistas() {
  const [loading, setLoading] = useState(true);
  const [frentistas, setFrentistas] = useState<Frentista[]>([]);
  const [checkins, setCheckins] = useState<CheckinData[]>([]);
  const [stats, setStats] = useState<FrentistaStats[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedFrentista, setSelectedFrentista] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch frentistas
    const { data: frentistasData } = await supabase
      .from('frentistas')
      .select('*')
      .order('nome');
    
    setFrentistas(frentistasData || []);

    // Fetch checkins in date range
    const { data: checkinsData } = await supabase
      .from('checkins')
      .select('id, phone, attendant_code, created_at, origin')
      .gte('created_at', startOfDay(new Date(startDate)).toISOString())
      .lte('created_at', endOfDay(new Date(endDate)).toISOString())
      .not('attendant_code', 'is', null)
      .order('created_at', { ascending: false });

    setCheckins(checkinsData || []);
    
    // Calculate stats
    calculateStats(frentistasData || [], checkinsData || []);
    calculateDailyData(frentistasData || [], checkinsData || []);
    
    setLoading(false);
  };

  const calculateStats = (frentistasData: Frentista[], checkinsData: CheckinData[]) => {
    const totalCheckins = checkinsData.length;
    const days = Math.max(1, differenceInDays(new Date(endDate), new Date(startDate)) + 1);
    
    const statsMap: Record<string, FrentistaStats> = {};
    
    // Initialize with registered frentistas
    frentistasData.forEach(f => {
      statsMap[f.codigo] = {
        codigo: f.codigo,
        nome: f.nome,
        total: 0,
        media_diaria: 0,
        ultimo_atendimento: null,
        porcentagem: 0
      };
    });

    // Count checkins
    checkinsData.forEach(c => {
      if (c.attendant_code) {
        if (!statsMap[c.attendant_code]) {
          statsMap[c.attendant_code] = {
            codigo: c.attendant_code,
            nome: `Frentista ${c.attendant_code}`,
            total: 0,
            media_diaria: 0,
            ultimo_atendimento: null,
            porcentagem: 0
          };
        }
        statsMap[c.attendant_code].total++;
        if (!statsMap[c.attendant_code].ultimo_atendimento) {
          statsMap[c.attendant_code].ultimo_atendimento = c.created_at;
        }
      }
    });

    // Calculate percentages and averages
    const statsArray = Object.values(statsMap)
      .map(s => ({
        ...s,
        media_diaria: Math.round((s.total / days) * 10) / 10,
        porcentagem: totalCheckins > 0 ? Math.round((s.total / totalCheckins) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    setStats(statsArray);
  };

  const calculateDailyData = (frentistasData: Frentista[], checkinsData: CheckinData[]) => {
    const days = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
    const dailyMap: Record<string, Record<string, string | number>> = {};

    // Initialize days
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(endDate), days - 1 - i), 'dd/MM');
      dailyMap[date] = { date };
      frentistasData.forEach(f => {
        dailyMap[date][f.codigo] = 0;
      });
    }

    // Count checkins per day per frentista
    checkinsData.forEach(c => {
      if (c.attendant_code) {
        const date = format(new Date(c.created_at), 'dd/MM');
        if (dailyMap[date]) {
          const current = dailyMap[date][c.attendant_code];
          dailyMap[date][c.attendant_code] = (typeof current === 'number' ? current : 0) + 1;
        }
      }
    });

    setDailyData(Object.values(dailyMap));
  };

  const filteredCheckins = selectedFrentista === 'all' 
    ? checkins 
    : checkins.filter(c => c.attendant_code === selectedFrentista);

  const totalAtendimentos = checkins.length;
  const topFrentista = stats[0];
  const activeFrentistas = stats.filter(s => s.total > 0).length;

  const exportCSV = () => {
    const headers = ['Código', 'Nome', 'Total Atendimentos', 'Média Diária', 'Participação %', 'Último Atendimento'];
    const rows = stats.map(s => [
      s.codigo,
      s.nome,
      s.total,
      s.media_diaria,
      `${s.porcentagem}%`,
      s.ultimo_atendimento ? format(new Date(s.ultimo_atendimento), 'dd/MM/yyyy HH:mm') : 'N/A'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_frentistas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const pieData = stats
    .filter(s => s.total > 0)
    .slice(0, 6)
    .map((s, i) => ({
      name: s.nome,
      value: s.total,
      color: COLORS[i % COLORS.length]
    }));

  return (
    <AdminLayout title="Relatório de Frentistas">
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label>Frentista</Label>
                <Select value={selectedFrentista} onValueChange={setSelectedFrentista}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {frentistas.map(f => (
                      <SelectItem key={f.id} value={f.codigo}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Atendimentos</p>
                  <p className="text-3xl font-bold">{totalAtendimentos}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Fuel className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Frentistas Ativos</p>
                  <p className="text-3xl font-bold">{activeFrentistas}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Frentista</p>
                  <p className="text-xl font-bold truncate">{topFrentista?.nome || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{topFrentista?.total || 0} atendimentos</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Média por Frentista</p>
                  <p className="text-3xl font-bold">
                    {activeFrentistas > 0 ? Math.round(totalAtendimentos / activeFrentistas) : 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bar Chart - Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Ranking de Atendimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.filter(s => s.total > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.filter(s => s.total > 0).slice(0, 8)} layout="vertical">
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value} atendimentos`, 'Total']}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado no período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart - Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Distribuição de Atendimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} atendimentos`, 'Total']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado no período
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Evolution Chart */}
        {dailyData.length > 1 && frentistas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Evolução Diária
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {frentistas.slice(0, 5).map((f, i) => (
                    <Line
                      key={f.codigo}
                      type="monotone"
                      dataKey={f.codigo}
                      name={f.nome}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Stats Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento por Frentista</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posição</TableHead>
                  <TableHead>Frentista</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Média/Dia</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead>Último Atendimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s, index) => (
                  <TableRow key={s.codigo}>
                    <TableCell>
                      {index < 3 ? (
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} #{index + 1}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">#{index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.codigo}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{s.total}</TableCell>
                    <TableCell className="text-right">{s.media_diaria}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${s.porcentagem}%` }}
                          />
                        </div>
                        <span className="text-sm">{s.porcentagem}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.ultimo_atendimento ? (
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(s.ultimo_atendimento), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum dado encontrado no período selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Checkins */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Atendimentos Recentes
              {selectedFrentista !== 'all' && (
                <Badge variant="secondary">
                  Filtrado: {frentistas.find(f => f.codigo === selectedFrentista)?.nome}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Frentista</TableHead>
                  <TableHead>Telefone Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCheckins.slice(0, 20).map((c) => {
                  const frentista = frentistas.find(f => f.codigo === c.attendant_code);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{frentista?.nome || c.attendant_code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        ****{c.phone?.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.origin || 'pwa'}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredCheckins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum atendimento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
