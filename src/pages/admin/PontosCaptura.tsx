import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Loader2, QrCode, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link } from 'react-router-dom';

interface CapturePoint {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  location: string | null;
  frentista_id: string | null;
  terminal_id: string | null;
  is_active: boolean | null;
  created_at: string;
  frentistas?: { nome: string; codigo: string } | null;
}

interface FormData {
  name: string;
  tag: string;
  description: string;
  location: string;
  frentista_id: string;
  terminal_id: string;
  is_active: boolean;
}

const initialFormData: FormData = {
  name: '',
  tag: '',
  description: '',
  location: '',
  frentista_id: '',
  terminal_id: '',
  is_active: true,
};

export default function PontosCaptura() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<CapturePoint | null>(null);
  const [deletingPoint, setDeletingPoint] = useState<CapturePoint | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Fetch capture points
  const { data: capturePoints, isLoading } = useQuery({
    queryKey: ['qr-capture-points-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_capture_points')
        .select('*, frentistas(nome, codigo)')
        .order('name');
      
      if (error) throw error;
      return data as CapturePoint[];
    }
  });

  // Fetch frentistas
  const { data: frentistas } = useQuery({
    queryKey: ['frentistas-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frentistas')
        .select('id, nome, codigo')
        .eq('is_active', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from('qr_capture_points')
        .insert({
          name: data.name,
          tag: data.tag,
          description: data.description || null,
          location: data.location || null,
          frentista_id: data.frentista_id || null,
          terminal_id: data.terminal_id || null,
          is_active: data.is_active,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points'] });
      toast({ title: 'Ponto de captura criado com sucesso!' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar ponto', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from('qr_capture_points')
        .update({
          name: data.name,
          tag: data.tag,
          description: data.description || null,
          location: data.location || null,
          frentista_id: data.frentista_id || null,
          terminal_id: data.terminal_id || null,
          is_active: data.is_active,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points'] });
      toast({ title: 'Ponto de captura atualizado!' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao atualizar ponto', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('qr_capture_points')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points'] });
      toast({ title: 'Ponto de captura excluído!' });
      setDeleteDialogOpen(false);
      setDeletingPoint(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao excluir ponto', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Toggle active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('qr_capture_points')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['qr-capture-points'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao alterar status', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const handleOpenCreate = () => {
    setEditingPoint(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (point: CapturePoint) => {
    setEditingPoint(point);
    setFormData({
      name: point.name,
      tag: point.tag,
      description: point.description || '',
      location: point.location || '',
      frentista_id: point.frentista_id || '',
      terminal_id: point.terminal_id || '',
      is_active: point.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPoint(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.tag.trim()) {
      toast({ 
        title: 'Preencha os campos obrigatórios', 
        variant: 'destructive' 
      });
      return;
    }

    if (editingPoint) {
      updateMutation.mutate({ id: editingPoint.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (point: CapturePoint) => {
    setDeletingPoint(point);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingPoint) {
      deleteMutation.mutate(deletingPoint.id);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout title="Pontos de Captura">
      <div className="space-y-6">
        {/* Header with action */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex-1">
            <div className="flex items-start gap-3">
              <MapPin className="h-6 w-6 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Pontos de Captura</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure os locais (bombas, caixas, etc.) que serão identificados via QR Code.
                  Cada ponto pode ter um frentista vinculado.
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/qrcode">
                <QrCode className="h-4 w-4 mr-2" />
                Gerar QR
              </Link>
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ponto
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pontos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : capturePoints && capturePoints.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Terminal Stone</TableHead>
                      <TableHead>Frentista</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capturePoints.map((point) => (
                      <TableRow key={point.id}>
                        <TableCell className="font-medium">{point.name}</TableCell>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded text-sm">{point.tag}</code>
                        </TableCell>
                        <TableCell>
                          {point.terminal_id ? (
                            <code className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">{point.terminal_id}</code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {point.frentistas ? (
                            <span>{point.frentistas.nome}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={point.is_active ?? true}
                            onCheckedChange={(checked) => 
                              toggleMutation.mutate({ id: point.id, is_active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(point)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(point)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Nenhum ponto cadastrado</p>
                <p className="text-sm mt-1">Crie seu primeiro ponto de captura</p>
                <Button onClick={handleOpenCreate} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Ponto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPoint ? 'Editar Ponto de Captura' : 'Novo Ponto de Captura'}
              </DialogTitle>
              <DialogDescription>
                Configure as informações do ponto de captura
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Bomba 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag">Tag (identificador único) *</Label>
                <Input
                  id="tag"
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  placeholder="ex: bomba1"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Usado na URL do QR Code. Apenas letras e números, sem espaços.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Local</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="ex: Ilha 1, Loja"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terminal_id">Terminal ID Stone</Label>
                <Input
                  id="terminal_id"
                  value={formData.terminal_id}
                  onChange={(e) => setFormData({ ...formData, terminal_id: e.target.value })}
                  placeholder="ex: 12345678"
                />
                <p className="text-xs text-muted-foreground">
                  Número de série da máquina Stone. Permite vincular automaticamente transações ao frentista.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional do ponto"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Frentista Vinculado</Label>
                <Select 
                  value={formData.frentista_id || "none"} 
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    frentista_id: value === "none" ? "" : value 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um frentista (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {frentistas?.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome} ({f.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Ativo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingPoint ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir ponto de captura?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{deletingPoint?.name}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
