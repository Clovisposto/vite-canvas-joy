import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  QrCode, 
  Smartphone, 
  Users, 
  Trophy, 
  Gift, 
  FileSpreadsheet,
  Phone,
  HelpCircle,
  CheckCircle
} from "lucide-react";

export default function AdminDuvidas() {
  const faqs = [
    {
      id: "qr-code",
      icon: QrCode,
      title: "Como funciona o QR Code?",
      content: `O QR Code é o ponto de entrada dos clientes no sistema. Quando escaneado:

1. O cliente é direcionado para o app do Posto 7
2. Passa pelo fluxo de cadastro (sorteio, dados, promoções)
3. Os dados ficam salvos automaticamente no sistema

Você pode gerar QR Codes personalizados em "QR Code" no menu lateral, incluindo:
- Código do frentista (para ranking)
- Tag identificadora (para campanhas específicas)

Imprima e cole em locais estratégicos: bombas, caixa, balcão.`
    },
    {
      id: "pwa",
      icon: Smartphone,
      title: "Como o cliente instala o app (PWA)?",
      content: `O app funciona direto no navegador, mas pode ser instalado como um aplicativo:

No Android:
1. Ao acessar, aparece um banner "Adicionar à tela inicial"
2. Ou clique nos 3 pontos > "Adicionar à tela inicial"

No iPhone:
1. Clique no ícone de compartilhar (quadrado com seta)
2. Role e clique em "Adicionar à Tela de Início"

Após instalado, o app fica com ícone na tela do celular e abre em tela cheia.`
    },
    {
      id: "captura",
      icon: Users,
      title: "Onde ver os telefones captados?",
      content: `Acesse "Captura de Cliente" no menu lateral. Lá você encontra:

- Lista completa de todos os check-ins
- Data, hora, telefone de cada cadastro
- Se aceitou sorteio (S/N)
- Se aceitou promoções (S/N)
- Consentimento LGPD
- Origem (QR Code, manual, etc.)
- Frentista responsável
- Pagamento, valor e litros (quando informado)

Use os filtros para encontrar registros específicos e exporte para CSV quando precisar.`
    },
    {
      id: "sorteio",
      icon: Trophy,
      title: "Como rodar o sorteio manual e automático?",
      content: `Sorteio Automático:
- Configurado em "Sorteios" > aba "Configuração"
- Por padrão: sábados às 08:00 e 15:00
- Roda automaticamente se houver elegíveis

Sorteio Manual:
1. Vá em "Sorteios"
2. Clique em "Rodar Sorteio Agora"
3. O sistema seleciona os ganhadores aleatoriamente
4. Resultado fica salvo no histórico

Requisitos para participar:
- Cliente deve ter accepts_raffle = true
- Deve ter feito check-in no período configurado

O histórico mostra: data, ganhadores, quantidade de elegíveis e seed usado.`
    },
    {
      id: "promocoes",
      icon: Gift,
      title: "Como mudar promoções?",
      content: `Acesse "Promoções" no menu lateral:

Criar Promoção:
1. Clique em "Nova Promoção"
2. Preencha título, descrição, tipo e valor
3. Selecione formas de pagamento elegíveis
4. Defina período de validade
5. Ative quando estiver pronta

Tipos disponíveis:
- Informativa: apenas comunicação
- Desconto: valor em R$ ou %
- Brinde: produto/serviço grátis

Disparo:
- Se houver integração WhatsApp: disparo automático
- Sem integração: modo assistido (click-to-WhatsApp)`
    },
    {
      id: "csv",
      icon: FileSpreadsheet,
      title: "Como importar CSV (Cielo/Posto Gestor)?",
      content: `Acesse "Integrações" > "Importar CSV":

1. Faça upload do arquivo CSV
2. Mapeie as colunas:
   - Telefone (obrigatório)
   - Data/hora da transação
   - Valor, litros, forma de pagamento
3. Configure a janela de tempo (default: 60 min)
4. Execute a importação

O sistema:
- Busca cliente pelo telefone
- Atualiza check-ins existentes no período
- Não duplica registros
- Gera log da importação

Formatos suportados: CSV com separador vírgula ou ponto-e-vírgula.`
    },
    {
      id: "controlador",
      icon: Phone,
      title: "Qual telefone comanda o sistema?",
      content: `Telefone Controlador: 55 94 99132-4567

Este é o número cadastrado como administrador do sistema. Ele:
- Recebe notificações importantes
- É usado como WhatsApp do posto
- Aparece no botão de contato do app cliente

Para alterar, vá em "Configurações" e atualize o campo "Telefone do Posto".

Formato: código do país + DDD + número (sem espaços ou traços)`
    }
  ];

  return (
    <AdminLayout title="Dúvidas / Como Usar">
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <faq.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{faq.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-12 pr-4 pb-2">
                      <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                        {faq.content}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Precisa de Ajuda?</h3>
                <p className="text-muted-foreground mt-1">
                  Entre em contato pelo WhatsApp do posto: <strong className="text-primary">55 94 99132-4567</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ou acesse "Manual/Demo" para rodar uma demonstração completa do sistema.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
