import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

export default function AdminAtendimento() {
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
    const { data } = await supabase.from('complaints').select('*').order('created_at', { ascending: false });
    setComplaints(data || []);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('complaints').update({ status, resolved_at: status === 'resolvido' ? new Date().toISOString() : null }).eq('id', id);
    fetchComplaints();
  };

  const exportCSV = () => {
    const headers = ['Data', 'Telefone', 'Mensagem', 'Status'];
    const rows = complaints.map(c => [format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'), c.phone, c.message, c.status]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'atendimento.csv'; a.click();
  };

  return (
    <AdminLayout title="Atendimento">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Reclamações/Sugestões</CardTitle>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Telefone</TableHead><TableHead>Mensagem</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {complaints.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{c.message}</TableCell>
                  <TableCell>
                    <Select value={c.status} onValueChange={v => updateStatus(c.id, v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_tratamento">Em Tratamento</SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
