import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ParsedContact {
  phone: string;
  name: string | null;
  valid: boolean;
  error?: string;
}

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Normaliza telefone para formato E.164 brasileiro
const normalizePhone = (phone: string): string | null => {
  if (!phone) return null;
  
  // Remove tudo que não for dígito
  let digits = phone.replace(/\D/g, '');
  
  // Mínimo 10 dígitos (DDD + 8), máximo 13 (55 + DDD + 9)
  if (digits.length < 10 || digits.length > 13) return null;
  
  // Se começa com 0, remove (ex: 094991234567 -> 94991234567)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  // Se não começa com 55, adiciona código do país
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Valida tamanho final: 12 (55+DDD+8) ou 13 (55+DDD+9) dígitos
  if (digits.length < 12 || digits.length > 13) return null;
  
  return digits;
};

// Detecta o separador do CSV
const detectSeparator = (firstLine: string): string => {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

// Encontra os índices das colunas de telefone e nome
const findColumns = (headers: string[]): { phoneIndex: number; nameIndex: number } => {
  const phonePatterns = ['phone', 'telefone', 'phone_e164', 'celular', 'mobile', 'whatsapp'];
  const namePatterns = ['name', 'nome', 'customer_name', 'cliente', 'nome_cliente'];
  
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  let phoneIndex = -1;
  let nameIndex = -1;
  
  for (const pattern of phonePatterns) {
    const idx = lowerHeaders.findIndex(h => h.includes(pattern));
    if (idx !== -1) {
      phoneIndex = idx;
      break;
    }
  }
  
  for (const pattern of namePatterns) {
    const idx = lowerHeaders.findIndex(h => h.includes(pattern));
    if (idx !== -1) {
      nameIndex = idx;
      break;
    }
  }
  
  return { phoneIndex, nameIndex };
};

export default function CSVImportDialog({ open, onOpenChange, onImportComplete }: CSVImportDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const resetState = useCallback(() => {
    setFile(null);
    setContacts([]);
    setResult(null);
    setError(null);
    setProgress(0);
    setParsing(false);
    setImporting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);
    setResult(null);
    setContacts([]);
    
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Por favor, selecione um arquivo CSV');
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 5MB');
      return;
    }
    
    setFile(selectedFile);
    setParsing(true);
    
    try {
      const text = await selectedFile.text();
      // Normaliza quebras de linha (Windows CRLF -> LF)
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalizedText.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('Arquivo vazio ou sem dados');
        setParsing(false);
        return;
      }
      
      const separator = detectSeparator(lines[0]);
      const headers = lines[0].split(separator).map(h => h.replace(/"/g, '').replace(/\r/g, '').trim());
      const { phoneIndex, nameIndex } = findColumns(headers);
      
      if (phoneIndex === -1) {
        setError('Coluna de telefone não encontrada. Certifique-se de ter uma coluna como "phone", "telefone" ou "phone_e164"');
        setParsing(false);
        return;
      }
      
      const parsed: ParsedContact[] = [];
      const seenPhones = new Set<string>();
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.replace(/"/g, '').replace(/\r/g, '').trim());
        const rawPhone = values[phoneIndex] || '';
        const rawName = nameIndex !== -1 ? values[nameIndex] : null;
        
        const normalizedPhone = normalizePhone(rawPhone);
        
        if (!normalizedPhone) {
          parsed.push({
            phone: rawPhone,
            name: rawName,
            valid: false,
            error: 'Telefone inválido'
          });
          continue;
        }
        
        if (seenPhones.has(normalizedPhone)) {
          parsed.push({
            phone: normalizedPhone,
            name: rawName,
            valid: false,
            error: 'Duplicado no arquivo'
          });
          continue;
        }
        
        seenPhones.add(normalizedPhone);
        parsed.push({
          phone: normalizedPhone,
          name: rawName || null,
          valid: true
        });
      }
      
      setContacts(parsed);
    } catch (err: any) {
      setError(`Erro ao processar arquivo: ${err.message}`);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleImport = async () => {
    const validContacts = contacts.filter(c => c.valid);
    
    if (validContacts.length === 0) {
      toast({
        title: 'Nenhum contato válido',
        description: 'Verifique o arquivo e tente novamente',
        variant: 'destructive'
      });
      return;
    }
    
    setImporting(true);
    setProgress(0);
    
    const batchSize = 50;
    const results: ImportResult = {
      total: validContacts.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    
    try {
      // Buscar telefones existentes em lotes (evita query muito grande)
      const phones = validContacts.map(c => c.phone);
      const existingPhones = new Set<string>();
      const checkBatchSize = 100;
      
      for (let i = 0; i < phones.length; i += checkBatchSize) {
        const batch = phones.slice(i, i + checkBatchSize);
        const { data } = await supabase
          .from('customers')
          .select('phone')
          .in('phone', batch);
        
        (data || []).forEach(c => existingPhones.add(c.phone));
        setProgress(Math.round((i / phones.length) * 20)); // 0-20% para checagem
      }
      
      // Separar novos e existentes
      const newContacts = validContacts.filter(c => !existingPhones.has(c.phone));
      const updateContacts = validContacts.filter(c => existingPhones.has(c.phone) && c.name);
      
      // Inserir novos em lotes
      for (let i = 0; i < newContacts.length; i += batchSize) {
        const batch = newContacts.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('customers')
          .insert(
            batch.map(c => ({
              phone: c.phone,
              name: c.name || null,
              lgpd_consent: false,
              accepts_raffle: false,
              accepts_promo: false,
            }))
          );
        
        if (error) {
          results.errors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          results.inserted += batch.length;
        }
        
        // Progress de 20-100% para inserção
        setProgress(20 + Math.round(((i + batch.length) / validContacts.length) * 80));
      }
      
      // Atualizar nomes para contatos existentes (apenas se tiver nome)
      for (let i = 0; i < updateContacts.length; i += batchSize) {
        const batch = updateContacts.slice(i, i + batchSize);
        
        for (const contact of batch) {
          const { error } = await supabase
            .from('customers')
            .update({ name: contact.name })
            .eq('phone', contact.phone)
            .is('name', null); // Só atualiza se não tiver nome
          
          if (!error) {
            results.updated++;
          }
        }
      }
      
      results.skipped = existingPhones.size - results.updated;
      setResult(results);
      setProgress(100);
      
      toast({
        title: 'Importação concluída!',
        description: `${results.inserted} novos, ${results.updated} atualizados, ${results.skipped} já existentes`
      });
      
      onImportComplete?.();
    } catch (err: any) {
      toast({
        title: 'Erro na importação',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  const validCount = contacts.filter(c => c.valid).length;
  const invalidCount = contacts.filter(c => !c.valid).length;
  const previewContacts = contacts.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contatos via CSV
          </DialogTitle>
          <DialogDescription>
            Importe contatos de um arquivo CSV para a base de clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Upload Area */}
          {!file && !result && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Arraste um arquivo CSV ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-1">
                Suporta colunas: phone_e164, telefone, customer_name, nome
              </p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          )}

          {/* Parsing Indicator */}
          {parsing && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Processando arquivo...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {contacts.length > 0 && !result && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{file?.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">{validCount} válidos</Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive">{invalidCount} inválidos</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewContacts.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                        <TableCell>{c.name || '-'}</TableCell>
                        <TableCell>
                          {c.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-destructive">{c.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {contacts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  Mostrando 5 de {contacts.length} contatos
                </p>
              )}
            </>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importando...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Result */}
          {result && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Importação concluída!
                  </p>
                  <ul className="text-sm space-y-0.5">
                    <li>✓ {result.inserted} contatos inseridos</li>
                    <li>✓ {result.updated} nomes atualizados</li>
                    <li>○ {result.skipped} já existentes (ignorados)</li>
                    {result.errors.length > 0 && (
                      <li className="text-destructive">✗ {result.errors.length} erros</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing || parsing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {validCount} contatos
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
