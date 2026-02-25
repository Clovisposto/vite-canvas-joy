import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';

interface HourlyData {
  hora: string;
  disparos: number;
  abastecimentos: number;
  litros: number;
  valor_venda: number;
  lucro_liquido: number;
  aproveitamento: number;
}

const MARGIN_PERCENT = 0.08; // 8% margem líquida estimada

export default function GraficoProducaoDisparos() {
  const [data, setData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period));

    const { data: raw, error } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('sent_at, phone_e164, status')
      .not('sent_at', 'is', null)
      .gte('sent_at', since.toISOString());

    if (error || !raw) {
      setLoading(false);
      return;
    }

    // Get checkins in the same period
    const { data: checkins } = await supabase
      .from('checkins')
      .select('phone, created_at, amount, liters')
      .gte('created_at', since.toISOString());

    // Build hourly buckets (6h-22h)
    const buckets: Record<number, { disparos: number; phones: Set<string> }> = {};
    for (let h = 6; h <= 22; h++) {
      buckets[h] = { disparos: 0, phones: new Set() };
    }

    raw.forEach((r: any) => {
      if (!r.sent_at) return;
      const hour = new Date(r.sent_at).getUTCHours();
      // Ajuste UTC-3 para horário de Brasília
      const brHour = (hour - 3 + 24) % 24;
      if (buckets[brHour]) {
        buckets[brHour].disparos++;
        buckets[brHour].phones.add(r.phone_e164);
      }
    });

    // Match checkins to dispatch hours
    const checkinsByHour: Record<number, { count: number; liters: number; amount: number }> = {};
    for (let h = 6; h <= 22; h++) {
      checkinsByHour[h] = { count: 0, liters: 0, amount: 0 };
    }

    (checkins || []).forEach((c: any) => {
      const hour = new Date(c.created_at).getUTCHours();
      const brHour = (hour - 3 + 24) % 24;
      if (checkinsByHour[brHour]) {
        checkinsByHour[brHour].count++;
        checkinsByHour[brHour].liters += c.liters || 0;
        checkinsByHour[brHour].amount += c.amount || 0;
      }
    });

    const chartData: HourlyData[] = [];
    for (let h = 6; h <= 22; h++) {
      const d = buckets[h];
      const c = checkinsByHour[h];
      const aproveitamento = d.disparos > 0 ? Math.round((c.count / d.disparos) * 100) : 0;
      chartData.push({
        hora: `${h}:00`,
        disparos: d.disparos,
        abastecimentos: c.count,
        litros: Math.round(c.liters * 10) / 10,
        valor_venda: Math.round(c.amount * 100) / 100,
        lucro_liquido: Math.round(c.amount * MARGIN_PERCENT * 100) / 100,
        aproveitamento,
      });
    }

    setData(chartData);
    setLoading(false);
  };

  const totals = useMemo(() => {
    return data.reduce(
      (acc, d) => ({
        disparos: acc.disparos + d.disparos,
        abastecimentos: acc.abastecimentos + d.abastecimentos,
        litros: acc.litros + d.litros,
        valor: acc.valor + d.valor_venda,
        lucro: acc.lucro + d.lucro_liquido,
      }),
      { disparos: 0, abastecimentos: 0, litros: 0, valor: 0, lucro: 0 }
    );
  }, [data]);

  const aprovGeral = totals.disparos > 0 ? Math.round((totals.abastecimentos / totals.disparos) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Produção por Horário de Disparo
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Disparos</div>
                <div className="text-lg font-bold">{totals.disparos}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Abastecimentos</div>
                <div className="text-lg font-bold">{totals.abastecimentos}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Litros</div>
                <div className="text-lg font-bold text-blue-600">{totals.litros.toFixed(0)}L</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Vendas</div>
                <div className="text-lg font-bold text-green-600">R${totals.valor.toFixed(0)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Lucro Líq.</div>
                <div className="text-lg font-bold text-emerald-600">R${totals.lucro.toFixed(0)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">Aproveitamento</div>
                <div className="text-lg font-bold text-primary">{aprovGeral}%</div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        disparos: 'Disparos',
                        abastecimentos: 'Abastecimentos',
                        litros: 'Litros',
                        valor_venda: 'Valor Venda (R$)',
                        lucro_liquido: 'Lucro Líq. (R$)',
                        aproveitamento: 'Aproveitamento (%)',
                      };
                      return [typeof value === 'number' ? value.toLocaleString('pt-BR') : value, labels[name] || name];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const labels: Record<string, string> = {
                        disparos: 'Disparos',
                        abastecimentos: 'Abastecimentos',
                        litros: 'Litros',
                        valor_venda: 'Valor Venda',
                        lucro_liquido: 'Lucro Líquido',
                        aproveitamento: 'Aproveitamento %',
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="disparos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="abastecimentos" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="litros" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="aproveitamento" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              * Lucro líquido estimado com margem de {MARGIN_PERCENT * 100}%. Aproveitamento = abastecimentos ÷ disparos no horário.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
