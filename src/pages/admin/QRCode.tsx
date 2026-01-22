import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { Copy, Download, Printer, Check, QrCode, MapPin, User, X, FileText, Maximize2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getPublicBaseUrl } from '@/lib/public-url';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeTemplate } from '@/components/admin/QRCodeTemplate';

interface CapturePoint {
  id: string;
  name: string;
  tag: string;
  location: string | null;
  frentistas: {
    nome: string;
    codigo: string;
  } | null;
}

export default function AdminQRCode() {
  const [attendant, setAttendant] = useState('');
  const [tag, setTag] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [previewMode, setPreviewMode] = useState<'simple' | 'letterhead'>('letterhead');
  const [downloadSize, setDownloadSize] = useState<'full' | 'compact'>('full');
  const qrRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch capture points
  const { data: capturePoints = [], isLoading } = useQuery({
    queryKey: ['qr-capture-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_capture_points')
        .select(`
          id, 
          name, 
          tag, 
          location,
          frentistas (
            nome,
            codigo
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as CapturePoint[];
    }
  });

  // Fetch active frentistas for manual selection
  const { data: frentistas = [] } = useQuery({
    queryKey: ['frentistas-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frentistas')
        .select('id, nome, codigo')
        .eq('is_active', true)
        .order('nome');

      if (error) throw error;
      return data || [];
    }
  });

  const getUrlForPoint = (point: CapturePoint) => {
    const base = getPublicBaseUrl() + '/aplicativo';
    const params = new URLSearchParams();
    if (point.tag) params.set('tag', point.tag);
    if (point.frentistas?.codigo) params.set('a', point.frentistas.codigo);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const getUrl = () => {
    if (selectedPoint) {
      const point = capturePoints.find(p => p.id === selectedPoint);
      if (point) return getUrlForPoint(point);
    }
    
    const base = getPublicBaseUrl() + '/aplicativo';
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (attendant) params.set('a', attendant);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const getSelectedPointInfo = () => {
    if (selectedPoint) {
      const point = capturePoints.find(p => p.id === selectedPoint);
      if (point) {
        return {
          name: point.name,
          location: point.location,
          attendant: point.frentistas?.nome
        };
      }
    }
    return {
      name: tag || undefined,
      location: undefined,
      attendant: attendant ? frentistas.find(f => f.codigo === attendant)?.nome : undefined
    };
  };

  const handleSelectPoint = (pointId: string) => {
    setSelectedPoint(pointId);
    const point = capturePoints.find(p => p.id === pointId);
    if (point) {
      setTag(point.tag);
      setAttendant(point.frentistas?.codigo || '');
    }
  };

  const handlePrintLetterhead = () => {
    const pointInfo = getSelectedPointInfo();
    const url = getUrl();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Erro",
        description: "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão habilitados.",
        variant: "destructive"
      });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - Auto Posto Pará</title>
        <style>
          @page { size: A4; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: system-ui, -apple-system, sans-serif;
            width: 210mm;
            height: 297mm;
            display: flex;
            flex-direction: column;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 30px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-icon {
            width: 50px;
            height: 50px;
            background: #E85A5A;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 28px;
          }
          .logo-text h1 {
            color: #4A5568;
            font-size: 20px;
            font-weight: bold;
          }
          .logo-text p {
            color: #718096;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .slogan {
            background: #E85A5A;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
          }
          .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.03;
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .watermark-icon {
            width: 120px;
            height: 120px;
            background: #4A5568;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 60px;
          }
          .watermark-text {
            color: #4A5568;
            font-size: 40px;
            font-weight: bold;
          }
          .qr-wrapper {
            background: white;
            padding: 20px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            position: relative;
            z-index: 1;
          }
          .qr-wrapper svg, .qr-wrapper canvas { display: block; }
          .cta {
            color: #E85A5A;
            font-size: 24px;
            font-weight: bold;
            margin-top: 30px;
          }
          .point-info {
            margin-top: 20px;
            text-align: center;
          }
          .point-name {
            color: #4A5568;
            font-size: 20px;
            font-weight: 600;
          }
          .point-location, .point-attendant {
            color: #718096;
            font-size: 14px;
            margin-top: 4px;
          }
          .footer {
            background: #E85A5A;
            color: white;
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
          }
          .footer-group {
            display: flex;
            gap: 20px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            <div class="logo-icon">P</div>
            <div class="logo-text">
              <h1>AUTO POSTO PARÁ</h1>
              <p>Combustível & Lubrificantes</p>
            </div>
          </div>
          <div class="slogan">Confiança, Qualidade e Compromisso</div>
        </div>

        <div class="content">
          <div class="watermark">
            <div class="watermark-icon">P</div>
            <div class="watermark-text">AUTO POSTO PARÁ</div>
          </div>
          
          <div class="qr-wrapper" id="qr-container"></div>
          
          <p class="cta">📱 Escaneie e participe!</p>
          
          <div class="point-info">
            ${pointInfo.name ? `<p class="point-name">${pointInfo.name}</p>` : ''}
            ${pointInfo.location ? `<p class="point-location">${pointInfo.location}</p>` : ''}
            ${pointInfo.attendant ? `<p class="point-attendant">Frentista: ${pointInfo.attendant}</p>` : ''}
          </div>
        </div>

        <div class="footer">
          <div class="footer-group">
            <span>📄 CNPJ: 17.644.011/0001-07</span>
            <span>✉️ autopostopara@gmail.com</span>
          </div>
          <div class="footer-group">
            <span>📍 Av. Sete de Setembro, nº 127, Belém - Tucuruí/PA</span>
            <span>📞 (94) 99155-0011 / 99281-9113</span>
          </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.createElement('canvas'), '${url}', { 
            width: 250,
            margin: 2,
            errorCorrectionLevel: 'H'
          }, function(error, canvas) {
            if (error) console.error(error);
            document.getElementById('qr-container').appendChild(canvas);
            setTimeout(() => window.print(), 500);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadLetterhead = async () => {
    const url = getUrl();
    const pointInfo = getSelectedPointInfo();
    const isCompact = downloadSize === 'compact';
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const width = isCompact ? 400 : 794; // A4 width at 96 DPI or compact
    const height = isCompact ? 400 : 1123; // A4 height or compact square
    canvas.width = width * 2; // 2x for high DPI
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Colors
    const coral = '#E85A5A';
    const darkGray = '#4A5568';
    const lightGray = '#718096';

    // Header
    const headerHeight = isCompact ? 50 : 80;
    
    // Logo icon
    const iconSize = isCompact ? 30 : 50;
    const iconX = isCompact ? 15 : 30;
    const iconY = isCompact ? 10 : 15;
    ctx.fillStyle = coral;
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconSize, iconSize, 8);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.font = `bold ${isCompact ? 18 : 28}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('P', iconX + iconSize/2, iconY + iconSize/2 + (isCompact ? 6 : 10));

    // Logo text
    ctx.textAlign = 'left';
    ctx.fillStyle = darkGray;
    ctx.font = `bold ${isCompact ? 12 : 20}px system-ui`;
    ctx.fillText('AUTO POSTO PARÁ', iconX + iconSize + 10, iconY + (isCompact ? 15 : 25));
    ctx.fillStyle = lightGray;
    ctx.font = `${isCompact ? 8 : 11}px system-ui`;
    ctx.fillText('COMBUSTÍVEL & LUBRIFICANTES', iconX + iconSize + 10, iconY + (isCompact ? 28 : 42));

    // Slogan
    const sloganText = 'Confiança, Qualidade e Compromisso';
    ctx.font = `500 ${isCompact ? 8 : 12}px system-ui`;
    const sloganWidth = ctx.measureText(sloganText).width + (isCompact ? 16 : 40);
    const sloganX = width - sloganWidth - (isCompact ? 15 : 30);
    const sloganY = iconY;
    const sloganHeight = isCompact ? 22 : 35;
    
    ctx.fillStyle = coral;
    ctx.beginPath();
    ctx.roundRect(sloganX, sloganY, sloganWidth, sloganHeight, 6);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(sloganText, sloganX + sloganWidth/2, sloganY + sloganHeight/2 + (isCompact ? 3 : 4));

    // Watermark
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = darkGray;
    const wmIconSize = isCompact ? 80 : 120;
    const wmX = width/2 - wmIconSize - 20;
    const wmY = height/2 - wmIconSize/2;
    ctx.beginPath();
    ctx.roundRect(wmX, wmY, wmIconSize, wmIconSize, 20);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = `bold ${isCompact ? 40 : 60}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('P', wmX + wmIconSize/2, wmY + wmIconSize/2 + (isCompact ? 14 : 22));
    ctx.fillStyle = darkGray;
    ctx.font = `bold ${isCompact ? 24 : 40}px system-ui`;
    ctx.fillText('AUTO POSTO PARÁ', width/2 + 30, height/2 + 10);
    ctx.globalAlpha = 1;

    // QR Code
    const qrSize = isCompact ? 140 : 250;
    const qrX = (width - qrSize - 40) / 2;
    const qrY = isCompact ? 90 : 280;
    
    // QR wrapper shadow
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize + 40, qrSize + 40, 16);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Generate QR and draw
    try {
      const qrDataUrl = await QRCode.toDataURL(url, { 
        width: qrSize, 
        margin: 0,
        errorCorrectionLevel: 'H'
      });
      
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
      });
      
      ctx.drawImage(qrImg, qrX + 20, qrY + 20, qrSize, qrSize);
    } catch (e) {
      console.error('QR generation failed:', e);
    }

    // CTA
    ctx.fillStyle = coral;
    ctx.font = `bold ${isCompact ? 14 : 24}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('📱 Escaneie e participe!', width/2, qrY + qrSize + (isCompact ? 70 : 100));

    // Point info
    let infoY = qrY + qrSize + (isCompact ? 90 : 140);
    if (pointInfo.name) {
      ctx.fillStyle = darkGray;
      ctx.font = `600 ${isCompact ? 12 : 20}px system-ui`;
      ctx.fillText(pointInfo.name, width/2, infoY);
      infoY += isCompact ? 16 : 28;
    }
    if (pointInfo.location) {
      ctx.fillStyle = lightGray;
      ctx.font = `${isCompact ? 10 : 14}px system-ui`;
      ctx.fillText(pointInfo.location, width/2, infoY);
      infoY += isCompact ? 14 : 24;
    }
    if (pointInfo.attendant) {
      ctx.fillStyle = lightGray;
      ctx.font = `${isCompact ? 10 : 14}px system-ui`;
      ctx.fillText(`Frentista: ${pointInfo.attendant}`, width/2, infoY);
    }

    // Footer
    const footerHeight = isCompact ? 35 : 50;
    const footerY = height - footerHeight;
    ctx.fillStyle = coral;
    ctx.fillRect(0, footerY, width, footerHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = `${isCompact ? 7 : 11}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText('📄 CNPJ: 17.644.011/0001-07', isCompact ? 10 : 30, footerY + footerHeight/2 + 4);
    ctx.fillText('✉️ autopostopara@gmail.com', isCompact ? 120 : 220, footerY + footerHeight/2 + 4);
    
    ctx.textAlign = 'right';
    ctx.fillText('📞 (94) 99155-0011 / 99281-9113', width - (isCompact ? 10 : 30), footerY + footerHeight/2 + 4);
    if (!isCompact) {
      ctx.fillText('📍 Av. Sete de Setembro, nº 127, Belém - Tucuruí/PA', width - 250, footerY + footerHeight/2 + 4);
    }

    // Download
    const link = document.createElement('a');
    link.download = `qrcode-autoposto-${pointInfo.name || 'geral'}-${isCompact ? 'compact' : 'a4'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast({
      title: "Download concluído!",
      description: `QR Code ${isCompact ? 'compacto' : 'A4'} salvo com sucesso.`
    });
  };

  const handlePrintSimple = () => {
    const url = getUrl();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code</title>
        <style>
          body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .container { text-align: center; }
          h2 { font-family: system-ui; color: #333; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="qr"></div>
          <h2>${tag || 'QR Code'}</h2>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.createElement('canvas'), '${url}', { width: 300 }, function(error, canvas) {
            document.getElementById('qr').appendChild(canvas);
            setTimeout(() => window.print(), 300);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSimple = async () => {
    const url = getUrl();
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, url, { width: 400, margin: 2 });
    
    const link = document.createElement('a');
    link.download = `qrcode-${tag || 'geral'}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    toast({ title: "Download concluído!" });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getUrl());
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const clearSelection = () => {
    setSelectedPoint('');
    setTag('');
    setAttendant('');
  };

  const handlePrintAllLetterhead = async () => {
    setGeneratingAll(true);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Erro", description: "Habilite pop-ups", variant: "destructive" });
      setGeneratingAll(false);
      return;
    }

    const qrCards = await Promise.all(
      capturePoints.map(async (point) => {
        const url = getUrlForPoint(point);
        try {
          const dataUrl = await QRCode.toDataURL(url, { width: 150, margin: 1, errorCorrectionLevel: 'H' });
          return { point, dataUrl };
        } catch {
          return { point, dataUrl: '' };
        }
      })
    );

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - Auto Posto Pará</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .card {
            border: 1px solid #ddd;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            page-break-inside: avoid;
          }
          .card-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #E85A5A;
          }
          .logo-mini {
            width: 30px;
            height: 30px;
            background: #E85A5A;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
          }
          .card-header span {
            color: #4A5568;
            font-weight: bold;
            font-size: 11px;
          }
          .qr { margin: 10px 0; }
          .qr img { max-width: 120px; }
          .point-name { color: #4A5568; font-weight: 600; font-size: 14px; }
          .point-location { color: #718096; font-size: 10px; }
          .cta { color: #E85A5A; font-size: 11px; font-weight: bold; margin-top: 8px; }
          @media print { .card { border: 1px dashed #ccc; } }
        </style>
      </head>
      <body>
        <div class="grid">
          ${qrCards.map(({ point, dataUrl }) => `
            <div class="card">
              <div class="card-header">
                <div class="logo-mini">P</div>
                <span>AUTO POSTO PARÁ</span>
              </div>
              <div class="qr"><img src="${dataUrl}" alt="QR"></div>
              <p class="point-name">${point.name}</p>
              ${point.location ? `<p class="point-location">${point.location}</p>` : ''}
              ${point.frentistas?.nome ? `<p class="point-location">Frentista: ${point.frentistas.nome}</p>` : ''}
              <p class="cta">📱 Escaneie e participe!</p>
            </div>
          `).join('')}
        </div>
        <script>setTimeout(() => window.print(), 500);</script>
      </body>
      </html>
    `);
    printWindow.document.close();
    setGeneratingAll(false);
  };

  const url = getUrl();
  const pointInfo = getSelectedPointInfo();

  return (
    <AdminLayout title="Gerar QR Code">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <QrCode className="h-8 w-8 text-primary" />
          <div>
            <p className="text-muted-foreground">
              QR Codes com papel timbrado do Auto Posto Pará
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Configuração
              </CardTitle>
              <CardDescription>
                Selecione um ponto de captura ou configure manualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Select */}
              <div className="space-y-2">
                <Label>Ponto de Captura</Label>
                {isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando pontos...
                  </div>
                ) : (
                  <Select value={selectedPoint} onValueChange={handleSelectPoint}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um ponto cadastrado" />
                    </SelectTrigger>
                    <SelectContent>
                      {capturePoints.map((point) => (
                        <SelectItem key={point.id} value={point.id}>
                          {point.name} {point.location && `(${point.location})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou configure manualmente</span>
                </div>
              </div>

              {/* Manual Config */}
              <div className="space-y-2">
                <Label htmlFor="tag">Tag / Identificador</Label>
                <Input
                  id="tag"
                  value={tag}
                  onChange={(e) => { setTag(e.target.value); setSelectedPoint(''); }}
                  placeholder="Ex: bomba1, ilha2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendant">Frentista</Label>
                <Select 
                  value={attendant} 
                  onValueChange={(v) => { setAttendant(v); setSelectedPoint(''); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um frentista (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {frentistas.map((f) => (
                      <SelectItem key={f.id} value={f.codigo}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {f.nome} ({f.codigo})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(selectedPoint || tag || attendant) && (
                <Button variant="outline" size="sm" onClick={clearSelection} className="w-full">
                  <X className="mr-2 h-4 w-4" />
                  Limpar seleção
                </Button>
              )}

              {/* Download Size Option */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Tamanho do Download</Label>
                <div className="flex gap-2">
                  <Button
                    variant={downloadSize === 'full' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDownloadSize('full')}
                    className="flex-1"
                  >
                    <Maximize2 className="mr-2 h-4 w-4" />
                    A4 Completo
                  </Button>
                  <Button
                    variant={downloadSize === 'compact' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDownloadSize('compact')}
                    className="flex-1"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Compacto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview & Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Preview
                </span>
                <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'simple' | 'letterhead')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="letterhead" className="text-xs px-3">Papel Timbrado</TabsTrigger>
                    <TabsTrigger value="simple" className="text-xs px-3">Simples</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview */}
              <div className="flex justify-center p-4 bg-muted/50 rounded-lg overflow-hidden">
                {previewMode === 'letterhead' ? (
                  <div className="transform scale-[0.45] origin-top">
                    <QRCodeTemplate
                      ref={templateRef}
                      url={url}
                      pointName={pointInfo.name}
                      pointLocation={pointInfo.location}
                      attendantName={pointInfo.attendant}
                      size="full"
                    />
                  </div>
                ) : (
                  <div ref={qrRef} className="bg-white p-4 rounded-lg">
                    <QRCodeSVG value={url} size={150} level="H" includeMargin />
                    <p className="text-center text-sm font-medium mt-2 text-foreground">
                      {pointInfo.name || 'QR Code'}
                    </p>
                  </div>
                )}
              </div>

              {/* URL */}
              <div className="text-xs text-muted-foreground text-center break-all p-2 bg-muted rounded">
                {url}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleCopy} variant="outline">
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </Button>
                
                <Button 
                  onClick={previewMode === 'letterhead' ? handleDownloadLetterhead : handleDownloadSimple}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </Button>
                
                <Button 
                  onClick={previewMode === 'letterhead' ? handlePrintLetterhead : handlePrintSimple}
                  className="col-span-2"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir {previewMode === 'letterhead' ? 'com Papel Timbrado' : 'Simples'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All Points Grid */}
        {capturePoints.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pontos de Captura Cadastrados</CardTitle>
                  <CardDescription>
                    Clique para selecionar ou imprima todos de uma vez
                  </CardDescription>
                </div>
                <Button onClick={handlePrintAllLetterhead} disabled={generatingAll}>
                  <Printer className="mr-2 h-4 w-4" />
                  {generatingAll ? 'Gerando...' : 'Imprimir Todos'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {capturePoints.map((point) => (
                  <div
                    key={point.id}
                    onClick={() => handleSelectPoint(point.id)}
                    className={`cursor-pointer p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                      selectedPoint === point.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-center mb-2">
                      <QRCodeSVG value={getUrlForPoint(point)} size={60} level="L" />
                    </div>
                    <p className="text-xs font-medium text-center truncate">{point.name}</p>
                    {point.location && (
                      <p className="text-[10px] text-muted-foreground text-center truncate">
                        {point.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
