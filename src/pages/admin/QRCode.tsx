import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Copy, Check, QrCode, MapPin, Loader2, FileDown, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface CapturePoint {
  id: string;
  name: string;
  tag: string;
  location: string | null;
  frentistas: { nome: string; codigo: string } | null;
}

export default function AdminQRCode() {
  const { toast } = useToast();
  const [attendant, setAttendant] = useState('');
  const [tag, setTag] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/aplicativo` 
    : '/aplicativo';

  // Fetch capture points from database
  const { data: capturePoints, isLoading } = useQuery({
    queryKey: ['qr-capture-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_capture_points')
        .select('*, frentistas(nome, codigo)')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as CapturePoint[];
    }
  });

  // Fetch frentistas for attendant dropdown
  const { data: frentistas } = useQuery({
    queryKey: ['frentistas-active'],
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

  const handleSelectPoint = (pointId: string) => {
    setSelectedPoint(pointId);
    const point = capturePoints?.find(p => p.id === pointId);
    if (point) {
      setTag(point.tag);
      if (point.frentistas) {
        setAttendant(point.frentistas.codigo);
      } else {
        setAttendant('');
      }
    }
  };

  const getUrlForPoint = (point: CapturePoint) => {
    const params = new URLSearchParams();
    if (point.frentistas?.codigo) params.set('attendant_code', point.frentistas.codigo);
    params.set('tag', point.tag);
    const query = params.toString();
    return `${baseUrl}?${query}`;
  };
  
  const getUrl = () => {
    const params = new URLSearchParams();
    if (attendant) params.set('attendant_code', attendant);
    if (tag) params.set('tag', tag);
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  };

  const handlePrint = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const pointName = capturePoints?.find(p => p.id === selectedPoint)?.name || tag || 'Geral';
    win.document.write(`
      <html>
        <head><title>QR Code - Posto 7</title></head>
        <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;">
          <h2 style="margin-bottom:20px;">Posto 7 - Programa de Fidelidade</h2>
          <p style="margin-bottom:10px;font-weight:bold;">${pointName}</p>
          ${svg.outerHTML}
          <p style="margin-top:20px;font-size:12px;color:#666;">Escaneie para participar</p>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const handlePrintAll = () => {
    if (!capturePoints || capturePoints.length === 0) return;
    
    const win = window.open('', '_blank');
    if (!win) return;

    // Helper function to escape HTML and prevent XSS
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Generate QR codes HTML for all points (XSS-safe)
    const qrCodesHtml = capturePoints.map(point => {
      const url = getUrlForPoint(point);
      const safeName = escapeHtml(point.name);
      const safeLocation = point.location ? escapeHtml(point.location) : '';
      const safeFrentista = point.frentistas?.nome ? escapeHtml(point.frentistas.nome) : '';
      const safeUrl = escapeHtml(url);
      const safeTag = escapeHtml(point.tag);
      
      return `
        <div style="page-break-inside:avoid;margin-bottom:40px;text-align:center;border:2px solid #e5e5e5;padding:30px;border-radius:12px;">
          <h3 style="margin:0 0 5px 0;font-size:24px;">${safeName}</h3>
          ${safeLocation ? `<p style="margin:0 0 5px 0;color:#666;font-size:14px;">${safeLocation}</p>` : ''}
          ${safeFrentista ? `<p style="margin:0 0 15px 0;color:#888;font-size:12px;">Frentista: ${safeFrentista}</p>` : '<p style="margin:0 0 15px 0;"></p>'}
          <div id="qr-${safeTag}" style="display:inline-block;padding:20px;background:white;border-radius:8px;"></div>
          <p style="margin-top:15px;font-size:11px;color:#999;word-break:break-all;">${safeUrl}</p>
        </div>
      `;
    }).join('');

    win.document.write(`
      <html>
        <head>
          <title>QR Codes - Posto 7</title>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <style>
            @media print {
              .no-print { display: none !important; }
              .qr-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
          </style>
        </head>
        <body style="font-family:sans-serif;padding:20px;max-width:1200px;margin:0 auto;">
          <div class="no-print" style="text-align:center;margin-bottom:30px;padding:20px;background:#f5f5f5;border-radius:8px;">
            <h1 style="margin:0 0 10px 0;">Posto 7 - QR Codes</h1>
            <p style="margin:0 0 15px 0;color:#666;">Todos os pontos de captura</p>
            <button onclick="window.print()" style="padding:12px 24px;font-size:16px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;">
              🖨️ Imprimir Todos
            </button>
          </div>
          <div class="qr-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;">
            ${qrCodesHtml}
          </div>
          <script>
            ${capturePoints.map(point => `
              QRCode.toCanvas(document.createElement('canvas'), '${getUrlForPoint(point)}', { width: 200, margin: 2 }, function(error, canvas) {
                if (!error) {
                  document.getElementById('qr-${point.tag}').appendChild(canvas);
                }
              });
            `).join('')}
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownload = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx?.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.fillStyle = '#ffffff';
      ctx?.fillRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 50, 50, 300, 300);
      
      const link = document.createElement('a');
      link.download = `qrcode-posto7${attendant ? `-${attendant}` : ''}${tag ? `-${tag}` : ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getUrl());
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const clearSelection = () => {
    setSelectedPoint('');
    setTag('');
    setAttendant('');
  };

  return (
    <AdminLayout title="Gerador de QR Code">
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <QrCode className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground">Como funciona</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Gere QR codes personalizados para cada bomba ou frentista. Quando o cliente escanear, 
                o sistema identifica automaticamente a origem do cadastro.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Capture Point Selector */}
              <div>
                <Label>Ponto de Captura</Label>
                {isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando pontos...
                  </div>
                ) : (
                  <Select value={selectedPoint} onValueChange={handleSelectPoint}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione um ponto de captura" />
                    </SelectTrigger>
                    <SelectContent>
                      {capturePoints?.map(point => (
                        <SelectItem key={point.id} value={point.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{point.name}</span>
                            {point.location && (
                              <span className="text-xs text-muted-foreground">({point.location})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione um ponto cadastrado ou configure manualmente abaixo
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Ou configure manualmente:</p>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="attendant">Frentista (opcional)</Label>
                    <Select value={attendant || "none"} onValueChange={(val) => setAttendant(val === "none" ? "" : val)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione um frentista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {frentistas?.map(f => (
                          <SelectItem key={f.id} value={f.codigo}>
                            {f.nome} ({f.codigo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Identifica qual frentista gerou o cadastro
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="tag">Tag/Bomba (opcional)</Label>
                    <Input 
                      id="tag"
                      value={tag} 
                      onChange={e => { setTag(e.target.value); setSelectedPoint(''); }}
                      placeholder="ex: bomba1, ilha2" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Identifica a bomba ou local
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <Label>URL Gerada</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs break-all">
                    {getUrl()}
                  </div>
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* QR Code Display */}
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <div ref={qrRef} className="p-6 bg-white rounded-xl shadow-lg">
                <QRCodeSVG 
                  id="qr-code" 
                  value={getUrl()} 
                  size={220} 
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="flex gap-3 w-full">
                <Button onClick={handleDownload} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PNG
                </Button>
                <Button onClick={handlePrint} className="flex-1">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Templates from Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pontos de Captura Cadastrados</span>
              <div className="flex gap-2">
                {selectedPoint && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Limpar seleção
                  </Button>
                )}
                {capturePoints && capturePoints.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handlePrintAll}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Todos
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : capturePoints && capturePoints.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {capturePoints.map(point => (
                  <div 
                    key={point.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPoint === point.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectPoint(point.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{point.name}</h4>
                        {point.location && (
                          <p className="text-xs text-muted-foreground">{point.location}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {point.tag}
                      </Badge>
                    </div>
                    {point.frentistas && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 pt-2 border-t">
                        <User className="h-3 w-3" />
                        <span>{point.frentistas.nome}</span>
                        <span className="text-muted-foreground/60">({point.frentistas.codigo})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum ponto de captura cadastrado</p>
                <p className="text-sm">Configure os pontos na tela de Captura</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}