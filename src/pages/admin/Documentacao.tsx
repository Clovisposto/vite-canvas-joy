import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, Layout, Workflow, Server, Shield, Users, 
  Smartphone, Settings, Bot, MessageCircle, QrCode,
  Gift, BarChart3, CreditCard, BookOpen, MapPin,
  ArrowRight, CheckCircle, AlertTriangle, Lock
} from 'lucide-react';

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <Card className="mb-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="prose prose-sm max-w-none dark:prose-invert">{children}</CardContent>
  </Card>
);

const TableSchema = ({ name, columns, description }: { name: string; columns: { col: string; type: string; note?: string }[]; description: string }) => (
  <div className="mb-6">
    <h4 className="font-bold text-foreground flex items-center gap-2 mb-1">
      <Database className="h-4 w-4 text-primary" />
      {name}
    </h4>
    <p className="text-sm text-muted-foreground mb-2">{description}</p>
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2 font-semibold">Coluna</th>
            <th className="text-left p-2 font-semibold">Tipo</th>
            <th className="text-left p-2 font-semibold">Obs</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c, i) => (
            <tr key={i} className="border-t border-border">
              <td className="p-2 font-mono text-primary">{c.col}</td>
              <td className="p-2 font-mono">{c.type}</td>
              <td className="p-2 text-muted-foreground">{c.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function Documentacao() {
  return (
    <AdminLayout title="Documentação do Sistema">
      <Tabs defaultValue="visao" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="schema">Schema BD</TabsTrigger>
          <TabsTrigger value="telas">Telas & Rotas</TabsTrigger>
          <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
          <TabsTrigger value="edge">Edge Functions</TabsTrigger>
          <TabsTrigger value="auth">Auth & RBAC</TabsTrigger>
          <TabsTrigger value="integ">Integrações</TabsTrigger>
        </TabsList>

        {/* ========== VISÃO GERAL ========== */}
        <TabsContent value="visao">
          <Section title="Visão Geral do Sistema" icon={BookOpen}>
            <p><strong>Posto 7 — Sistema de Fidelidade & Gestão</strong></p>
            <p>Plataforma completa para gestão de postos de combustível, incluindo:</p>
            <ul>
              <li><strong>PWA do Cliente</strong> — Cadastro via QR Code, participação em sorteios e promoções</li>
              <li><strong>Painel Administrativo</strong> — Dashboard, gestão de frentistas, promoções, sorteios, campanhas WhatsApp</li>
              <li><strong>Assistente IA</strong> — Comandos de voz e texto para executar ações no sistema</li>
              <li><strong>Integração WhatsApp</strong> — Envio automatizado via Evolution API / Cloud API</li>
              <li><strong>Integração Stone TEF</strong> — Recepção de transações de pagamento via webhook</li>
            </ul>
            <h4>Stack Tecnológico</h4>
            <ul>
              <li><strong>Frontend:</strong> React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui</li>
              <li><strong>Backend:</strong> Supabase (PostgreSQL + Edge Functions + Auth + RLS)</li>
              <li><strong>Animações:</strong> Framer Motion</li>
              <li><strong>Gráficos:</strong> Recharts</li>
              <li><strong>QR Code:</strong> qrcode.react</li>
              <li><strong>State:</strong> TanStack React Query + Context API</li>
              <li><strong>Deploy:</strong> Vercel (frontend) + Supabase Cloud (backend)</li>
            </ul>
          </Section>

          <Section title="Arquitetura de Alto Nível" icon={Server}>
            <div className="bg-muted p-4 rounded-lg font-mono text-xs leading-relaxed">
              <pre>{`
┌──────────────────┐     ┌─────────────────────────┐
│  PWA do Cliente  │────▶│    Supabase Backend      │
│  /aplicativo     │     │  ┌────────────────────┐  │
└──────────────────┘     │  │  PostgreSQL (RLS)   │  │
                         │  │  30+ tabelas        │  │
┌──────────────────┐     │  └────────────────────┘  │
│  Painel Admin    │────▶│  ┌────────────────────┐  │
│  /admin/*        │     │  │  Edge Functions     │  │
└──────────────────┘     │  │  14 funções         │  │
                         │  └────────────────────┘  │
┌──────────────────┐     │  ┌────────────────────┐  │
│  Stone Webhook   │────▶│  │  Auth (Supabase)    │  │
│  TEF Pagamentos  │     │  │  RBAC via user_roles│  │
└──────────────────┘     │  └────────────────────┘  │
                         └─────────────────────────┘
┌──────────────────┐              │
│  Evolution API   │◀─────────────┘
│  WhatsApp        │  (Edge Functions chamam)
└──────────────────┘
              `}</pre>
            </div>
          </Section>
        </TabsContent>

        {/* ========== SCHEMA BD ========== */}
        <TabsContent value="schema">
          <Section title="Schema do Banco de Dados" icon={Database}>
            <p>O banco utiliza <strong>PostgreSQL via Supabase</strong> com Row-Level Security (RLS) em todas as tabelas. Abaixo, todas as tabelas organizadas por domínio.</p>
          </Section>

          <Section title="Contatos & Clientes" icon={Users}>
            <TableSchema
              name="wa_contacts"
              description="Tabela principal de contatos/clientes. Substituiu a antiga 'customers'."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK, gen_random_uuid()' },
                { col: 'phone', type: 'varchar', note: 'UNIQUE, formato E.164 (5594991234567)' },
                { col: 'name', type: 'varchar', note: 'Nome do cliente' },
                { col: 'opt_in', type: 'boolean', note: 'Consentimento marketing (LGPD)' },
                { col: 'opt_in_timestamp', type: 'timestamptz', note: 'Data do consentimento' },
                { col: 'opt_out_timestamp', type: 'timestamptz', note: 'Data do opt-out' },
                { col: 'opt_out_reason', type: 'varchar', note: 'Motivo do cancelamento' },
                { col: 'flow_state', type: 'text', note: 'Estado no fluxo: new, active, etc' },
                { col: 'wa_id', type: 'varchar', note: 'ID do WhatsApp' },
                { col: 'created_at / updated_at', type: 'timestamptz', note: 'Timestamps automáticos' },
              ]}
            />
            <TableSchema
              name="whatsapp_optout"
              description="Registro de opt-out de WhatsApp."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'phone_e164', type: 'text', note: 'Telefone no formato E.164' },
                { col: 'reason', type: 'text', note: 'Motivo do opt-out' },
                { col: 'created_at', type: 'timestamptz', note: '' },
              ]}
            />
          </Section>

          <Section title="Check-ins & Operações" icon={CheckCircle}>
            <TableSchema
              name="checkins"
              description="Registros de abastecimento/check-in de clientes."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'phone', type: 'text', note: 'NOT NULL, FK → wa_contacts.phone' },
                { col: 'customer_id', type: 'uuid', note: 'Legacy FK (customers)' },
                { col: 'attendant_code', type: 'text', note: 'Código do frentista' },
                { col: 'payment_method', type: 'text', note: 'pix, dinheiro, debito, credito' },
                { col: 'amount', type: 'numeric(10,2)', note: 'Valor em R$' },
                { col: 'liters', type: 'numeric(10,2)', note: 'Litros abastecidos' },
                { col: 'tag', type: 'text', note: 'Tag do ponto de captura QR' },
                { col: 'origin', type: 'text', note: 'pwa, stone, api' },
                { col: 'is_demo', type: 'boolean', note: 'Flag de dado demo' },
                { col: 'stone_tef_id', type: 'uuid', note: 'FK → stone_tef_logs' },
                { col: 'created_at', type: 'timestamptz', note: '' },
              ]}
            />
            <TableSchema
              name="checkin_public_links"
              description="Links públicos temporários para status de check-in."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'checkin_id', type: 'uuid', note: 'FK → checkins' },
                { col: 'token', type: 'text', note: 'Token público único' },
                { col: 'expires_at', type: 'timestamptz', note: 'Expira em 24h' },
              ]}
            />
          </Section>

          <Section title="Frentistas & Stone TEF" icon={CreditCard}>
            <TableSchema
              name="frentistas"
              description="Cadastro de frentistas/atendentes."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'nome', type: 'text', note: 'NOT NULL' },
                { col: 'codigo', type: 'text', note: 'NOT NULL, código de identificação' },
                { col: 'terminal_id', type: 'varchar', note: 'Terminal Stone vinculado' },
                { col: 'is_active', type: 'boolean', note: 'Default: true' },
              ]}
            />
            <TableSchema
              name="frentistas_pins"
              description="PINs de autenticação de frentistas (hash)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'frentista_id', type: 'uuid', note: 'FK → frentistas, UNIQUE' },
                { col: 'pin_hash', type: 'text', note: 'Hash do PIN' },
                { col: 'is_active', type: 'boolean', note: '' },
              ]}
            />
            <TableSchema
              name="frentista_metas"
              description="Metas de desempenho de frentistas."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'frentista_id', type: 'uuid', note: 'FK → frentistas' },
                { col: 'target_checkins', type: 'integer', note: 'Meta de check-ins (default 50)' },
                { col: 'target_amount', type: 'numeric', note: 'Meta de valor R$' },
                { col: 'period_type', type: 'text', note: 'monthly, weekly, etc' },
                { col: 'start_date / end_date', type: 'date', note: 'Período da meta' },
                { col: 'is_active', type: 'boolean', note: '' },
              ]}
            />
            <TableSchema
              name="stone_tef_logs"
              description="Logs de transações da Stone TEF (webhook)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'valor', type: 'numeric', note: 'Valor da transação' },
                { col: 'forma_pagamento', type: 'varchar', note: 'credito, debito, pix' },
                { col: 'terminal_id', type: 'varchar', note: 'ID do terminal' },
                { col: 'frentista_id / frentista_nome', type: 'varchar', note: 'Frentista associado' },
                { col: 'nsu / autorizacao / bandeira', type: 'varchar', note: 'Dados da transação' },
                { col: 'checkin_id', type: 'uuid', note: 'FK → checkins (vinculação)' },
                { col: 'raw_data', type: 'jsonb', note: 'Payload completo' },
                { col: 'status', type: 'varchar', note: 'aprovado, negado, etc' },
              ]}
            />
          </Section>

          <Section title="Promoções, Sorteios & Prêmios" icon={Gift}>
            <TableSchema
              name="promotions"
              description="Promoções ativas do posto."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'title', type: 'text', note: 'NOT NULL' },
                { col: 'description', type: 'text', note: '' },
                { col: 'type', type: 'text', note: 'desconto, brinde, informativa' },
                { col: 'discount_value', type: 'numeric', note: 'Valor do desconto' },
                { col: 'eligible_payments', type: 'text[]', note: 'pix, dinheiro, debito' },
                { col: 'is_active', type: 'boolean', note: '' },
                { col: 'start_date / end_date', type: 'timestamptz', note: 'Vigência' },
              ]}
            />
            <TableSchema
              name="raffles"
              description="Configuração de sorteios."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'name', type: 'text', note: 'Nome do sorteio' },
                { col: 'winners_count', type: 'integer', note: 'Default: 3' },
                { col: 'prize_value', type: 'numeric', note: 'Default: 100.00' },
                { col: 'schedule_days', type: 'integer[]', note: '[6] = sábado' },
                { col: 'schedule_times', type: 'time[]', note: '08:00, 15:00' },
                { col: 'rules', type: 'text', note: 'Regras do sorteio' },
                { col: 'is_active', type: 'boolean', note: '' },
              ]}
            />
            <TableSchema
              name="raffle_runs"
              description="Histórico de execuções de sorteios."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'raffle_id', type: 'uuid', note: 'FK → raffles' },
                { col: 'eligible_count', type: 'integer', note: 'Total de elegíveis' },
                { col: 'winners', type: 'jsonb', note: 'Array de ganhadores' },
                { col: 'seed', type: 'text', note: 'Seed de aleatoriedade' },
                { col: 'executed_by', type: 'uuid', note: 'Quem executou' },
                { col: 'is_test', type: 'boolean', note: 'Sorteio de teste' },
              ]}
            />
            <TableSchema
              name="premios_qr"
              description="Prêmios QR com saldo consumível."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'codigo', type: 'text', note: 'Código único do prêmio' },
                { col: 'nome_ganhador', type: 'text', note: '' },
                { col: 'valor_original / valor_restante', type: 'numeric', note: 'Saldo do prêmio' },
                { col: 'status', type: 'text', note: 'ativo, zerado, expirado' },
                { col: 'data_expiracao', type: 'timestamptz', note: '' },
                { col: 'cpf / telefone', type: 'text', note: 'Dados do ganhador' },
              ]}
            />
            <TableSchema
              name="premios_qr_consumos"
              description="Histórico de abatimentos de prêmios."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'premio_id', type: 'uuid', note: 'FK → premios_qr' },
                { col: 'valor_abatido', type: 'numeric', note: '' },
                { col: 'valor_anterior / valor_apos', type: 'numeric', note: 'Antes e depois' },
                { col: 'consumido_por', type: 'uuid', note: 'Frentista/Admin' },
                { col: 'observacao', type: 'text', note: '' },
              ]}
            />
          </Section>

          <Section title="WhatsApp & Campanhas" icon={MessageCircle}>
            <TableSchema
              name="whatsapp_settings"
              description="Configuração do provedor WhatsApp (Evolution ou Cloud API)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'provider', type: 'text', note: 'EVOLUTION ou CLOUD_API' },
                { col: 'enabled', type: 'boolean', note: '' },
                { col: 'evolution_base_url / evolution_api_key / evolution_instance', type: 'text', note: 'Credenciais Evolution' },
                { col: 'cloud_access_token / cloud_phone_number_id / cloud_waba_id', type: 'text', note: 'Credenciais Cloud API' },
              ]}
            />
            <TableSchema
              name="wa_messages"
              description="Histórico de mensagens WhatsApp enviadas/recebidas."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'phone', type: 'varchar', note: 'Telefone E.164' },
                { col: 'direction', type: 'varchar', note: 'inbound, outbound' },
                { col: 'content', type: 'text', note: 'Texto da mensagem' },
                { col: 'message_type', type: 'varchar', note: 'text, template, image' },
                { col: 'status', type: 'varchar', note: 'pending, sent, delivered, read, failed' },
                { col: 'template_name / template_params', type: '', note: 'Para templates' },
                { col: 'provider', type: 'varchar', note: 'cloud_api, evolution' },
                { col: 'wa_message_id', type: 'varchar', note: 'ID externo do WhatsApp' },
              ]}
            />
            <TableSchema
              name="wa_templates"
              description="Templates de mensagem WhatsApp."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'name', type: 'varchar', note: 'Nome único' },
                { col: 'body', type: 'text', note: 'Corpo da mensagem' },
                { col: 'header_type / header_content', type: 'varchar/text', note: 'Cabeçalho' },
                { col: 'footer', type: 'text', note: '' },
                { col: 'buttons', type: 'jsonb', note: 'Array de botões' },
                { col: 'category', type: 'varchar', note: 'marketing, utility, etc' },
                { col: 'status', type: 'varchar', note: 'pending, approved, rejected' },
                { col: 'language', type: 'varchar', note: 'Default: pt_BR' },
                { col: 'meta_template_id', type: 'varchar', note: 'ID no Meta' },
              ]}
            />
            <TableSchema
              name="whatsapp_campaigns"
              description="Campanhas de disparo em massa."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'name / message', type: 'text', note: 'Nome e conteúdo' },
                { col: 'status', type: 'text', note: 'draft, scheduled, sending, completed, failed' },
                { col: 'template_name', type: 'text', note: 'Template a usar' },
                { col: 'target_filter', type: 'jsonb', note: 'Filtros de público-alvo' },
                { col: 'total_recipients / sent_count / failed_count', type: 'integer', note: 'Contadores' },
                { col: 'scheduled_for', type: 'timestamptz', note: 'Agendamento' },
                { col: 'created_by', type: 'uuid', note: 'Quem criou' },
              ]}
            />
            <TableSchema
              name="whatsapp_campaign_recipients"
              description="Destinatários individuais de cada campanha."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'campaign_id', type: 'uuid', note: 'FK → whatsapp_campaigns' },
                { col: 'phone_e164', type: 'text', note: '' },
                { col: 'customer_name', type: 'text', note: '' },
                { col: 'status', type: 'text', note: 'pending, sent, delivered, failed' },
                { col: 'sent_content', type: 'text', note: 'Conteúdo enviado' },
                { col: 'error', type: 'text', note: 'Mensagem de erro' },
                { col: 'dispatch_latency_ms', type: 'integer', note: 'Latência' },
              ]}
            />
          </Section>

          <Section title="IA & Sistema" icon={Bot}>
            <TableSchema
              name="ai_commands"
              description="Comandos reconhecidos pelo Assistente IA."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'command_pattern', type: 'text', note: 'Padrão regex/texto' },
                { col: 'command_type', type: 'text', note: 'action, navigation, query' },
                { col: 'action_type', type: 'text', note: 'navigate, create_promotion, etc' },
                { col: 'description', type: 'text', note: '' },
                { col: 'example_phrases', type: 'text[]', note: 'Frases de exemplo' },
                { col: 'requires_confirmation', type: 'boolean', note: 'Default: true' },
                { col: 'params_schema', type: 'jsonb', note: 'Schema dos parâmetros' },
                { col: 'is_active', type: 'boolean', note: '' },
              ]}
            />
            <TableSchema
              name="ai_command_logs"
              description="Logs de execução de comandos IA."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'raw_input', type: 'text', note: 'Entrada do usuário' },
                { col: 'recognized_action', type: 'text', note: 'Ação reconhecida' },
                { col: 'params_extracted', type: 'jsonb', note: 'Parâmetros extraídos' },
                { col: 'success', type: 'boolean', note: '' },
                { col: 'execution_time_ms', type: 'integer', note: '' },
                { col: 'voice_input', type: 'boolean', note: 'Se veio por voz' },
                { col: 'user_id', type: 'uuid', note: '' },
              ]}
            />
            <TableSchema
              name="ai_settings"
              description="Configurações do módulo IA (modo 24h, etc)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'key', type: 'text', note: 'UNIQUE' },
                { col: 'value', type: 'jsonb', note: '' },
                { col: 'description', type: 'text', note: '' },
              ]}
            />
            <TableSchema
              name="ai_chat_history"
              description="Histórico de conversas com o assistente IA."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'user_id', type: 'uuid', note: '' },
                { col: 'role', type: 'text', note: 'user, assistant' },
                { col: 'content', type: 'text', note: 'Conteúdo da mensagem' },
              ]}
            />
            <TableSchema
              name="settings"
              description="Configurações globais do sistema (key-value)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'key', type: 'text', note: 'UNIQUE (posto_name, whatsapp_number, etc)' },
                { col: 'value', type: 'jsonb', note: '' },
                { col: 'description', type: 'text', note: '' },
              ]}
            />
            <TableSchema
              name="profiles"
              description="Perfis de usuários administrativos."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK, FK → auth.users' },
                { col: 'email', type: 'text', note: '' },
                { col: 'full_name', type: 'text', note: '' },
                { col: 'role', type: 'text', note: 'Legacy: admin, operador, viewer' },
              ]}
            />
            <TableSchema
              name="user_roles"
              description="Roles RBAC (tabela principal de permissões)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'user_id', type: 'uuid', note: 'FK → auth.users' },
                { col: 'role', type: 'app_role', note: 'admin, operador, viewer' },
              ]}
            />
            <TableSchema
              name="audit_logs"
              description="Log de auditoria de ações no sistema."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'user_id', type: 'uuid', note: '' },
                { col: 'action', type: 'text', note: 'Ação realizada' },
                { col: 'table_name', type: 'text', note: 'Tabela afetada' },
                { col: 'record_id', type: 'uuid', note: '' },
                { col: 'old_data / new_data', type: 'jsonb', note: 'Snapshot antes/depois' },
              ]}
            />
            <TableSchema
              name="livro_caixa"
              description="Livro Caixa — registros financeiros do posto."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'tipo', type: 'varchar', note: 'entrada, saida' },
                { col: 'categoria', type: 'varchar', note: 'combustivel, servicos, etc' },
                { col: 'valor', type: 'numeric', note: '' },
                { col: 'data', type: 'date', note: '' },
                { col: 'descricao / observacoes', type: 'text', note: '' },
                { col: 'forma_pagamento', type: 'varchar', note: '' },
                { col: 'responsavel', type: 'varchar', note: '' },
              ]}
            />
            <TableSchema
              name="qr_capture_points"
              description="Pontos de captura QR Code (bombas, terminais)."
              columns={[
                { col: 'id', type: 'uuid', note: 'PK' },
                { col: 'name', type: 'varchar', note: 'Nome do ponto' },
                { col: 'tag', type: 'varchar', note: 'Tag única usada na URL' },
                { col: 'location', type: 'varchar', note: 'Localização física' },
                { col: 'terminal_id', type: 'varchar', note: 'Terminal Stone vinculado' },
                { col: 'frentista_id', type: 'uuid', note: 'FK → frentistas' },
                { col: 'is_active', type: 'boolean', note: '' },
              ]}
            />
          </Section>
        </TabsContent>

        {/* ========== TELAS & ROTAS ========== */}
        <TabsContent value="telas">
          <Section title="Rotas Públicas (sem autenticação)" icon={Smartphone}>
            <div className="space-y-3">
              {[
                { route: '/', desc: 'Redireciona para /aplicativo' },
                { route: '/aplicativo', desc: 'PWA do Cliente — Cadastro, nome, telefone, check-in via QR Code. Suporta parâmetros: ?phone=, ?tag=, ?attendant=' },
                { route: '/app', desc: 'Alias → /aplicativo' },
                { route: '/abastecimento/:token', desc: 'Status público de um check-in via token temporário (24h)' },
                { route: '/premio/:codigo', desc: 'Validação pública de prêmios QR — consulta saldo e status' },
                { route: '/admin/login', desc: 'Login do painel administrativo' },
                { route: '/admin/reset', desc: 'Redefinição de senha' },
              ].map((r) => (
                <div key={r.route} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="font-mono text-xs shrink-0 mt-0.5">{r.route}</Badge>
                  <span className="text-sm">{r.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Rotas Admin — Todos Autenticados" icon={Layout}>
            <div className="space-y-3">
              {[
                { route: '/admin', desc: 'Dashboard — KPIs, QR Code, status do sistema, capturas por ponto', role: 'any' },
                { route: '/admin/manual', desc: 'Manual interativo do sistema com modo demo', role: 'any' },
                { route: '/admin/duvidas', desc: 'FAQ e dúvidas frequentes', role: 'any' },
              ].map((r) => (
                <div key={r.route} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="font-mono text-xs shrink-0 mt-0.5">{r.route}</Badge>
                  <span className="text-sm">{r.desc}</span>
                  <Badge variant="secondary" className="shrink-0">Qualquer autenticado</Badge>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Rotas Admin — Staff (admin + operador)" icon={Users}>
            <div className="space-y-3">
              {[
                { route: '/admin/captura', desc: 'Captura manual de clientes' },
                { route: '/admin/frentista', desc: 'Gestão de frentistas e integração Stone' },
                { route: '/admin/relatorio-frentistas', desc: 'Relatório de desempenho por frentista' },
                { route: '/admin/relatorio-producao', desc: 'Relatório de produção consolidado' },
                { route: '/admin/producao', desc: 'Visão de produção diária/mensal' },
                { route: '/admin/sorteios', desc: 'Executar sorteios, definir regras' },
                { route: '/admin/historico-sorteios', desc: 'Histórico de todos os sorteios realizados' },
                { route: '/admin/promocoes', desc: 'CRUD de promoções' },
                { route: '/admin/atendimento', desc: 'Gestão de reclamações e sugestões' },
                { route: '/admin/qrcode', desc: 'Gerador de QR Codes personalizados' },
                { route: '/admin/qr-premiacao', desc: 'Gestão de prêmios QR com saldo' },
              ].map((r) => (
                <div key={r.route} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="font-mono text-xs shrink-0 mt-0.5">{r.route}</Badge>
                  <span className="text-sm">{r.desc}</span>
                  <Badge className="shrink-0 bg-blue-500/10 text-blue-700 border-blue-200">Staff</Badge>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Rotas Admin — Somente Admin" icon={Lock}>
            <div className="space-y-3">
              {[
                { route: '/admin/integracoes', desc: 'Importação CSV, configuração de integrações' },
                { route: '/admin/pontos-captura', desc: 'CRUD de pontos de captura QR' },
                { route: '/admin/whatsapp', desc: 'Configuração WhatsApp (Evolution/Cloud API)' },
                { route: '/admin/robo-whatsapp', desc: 'Robô de campanhas WhatsApp' },
                { route: '/admin/configuracoes', desc: 'Configurações gerais do sistema' },
                { route: '/admin/livro-caixa', desc: 'Livro Caixa financeiro' },
                { route: '/admin/ai-assistant', desc: 'Assistente IA com voz e comandos' },
              ].map((r) => (
                <div key={r.route} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="font-mono text-xs shrink-0 mt-0.5">{r.route}</Badge>
                  <span className="text-sm">{r.desc}</span>
                  <Badge className="shrink-0 bg-red-500/10 text-red-700 border-red-200">Admin</Badge>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* ========== FLUXOS ========== */}
        <TabsContent value="fluxos">
          <Section title="Fluxo do Cliente (PWA)" icon={Smartphone}>
            <div className="space-y-4">
              <h4 className="font-semibold">1. Cadastro via QR Code</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                <pre>{`
QR Code (bomba/terminal)
  │
  ▼
/aplicativo?tag=bomba1&phone=5594...
  │
  ├─ Preenche nome + telefone (pré-preenchido se ?phone)
  │
  ├─ Valida: 11 dígitos, DDD válido, começa com 9
  │
  ├─ Upsert em wa_contacts (opt_in = true)
  │
  ├─ RPC: public_create_checkin_and_token()
  │   ├─ Cria checkin em checkins
  │   ├─ Gera token público (checkin_public_links)
  │   └─ Auto-identifica frentista via tag → qr_capture_points → frentistas
  │
  ├─ Edge Function: raffle-confirmation (fire & forget)
  │   └─ Envia WhatsApp de confirmação
  │
  ├─ Tela de Confirmação (3s countdown)
  │
  └─ Tela de Agradecimento (auto-reset em 10s)
                `}</pre>
              </div>

              <h4 className="font-semibold">2. Validação de Prêmio QR</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                <pre>{`
/premio/:codigo
  │
  ├─ RPC: get_premio_publico(codigo)
  │   └─ Retorna: nome, valor_original, valor_restante, status, data_expiracao
  │
  └─ Exibe card com informações do prêmio
                `}</pre>
              </div>

              <h4 className="font-semibold">3. Fluxo de Sorteio</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                <pre>{`
Admin: /admin/sorteios
  │
  ├─ Busca checkins elegíveis (opt_in = true, período)
  │
  ├─ Gera seed aleatória
  │
  ├─ Seleciona N ganhadores (Fisher-Yates shuffle)
  │
  ├─ Insere em raffle_runs (winners JSONB)
  │
  └─ Opcionalmente cria premios_qr para cada ganhador
      └─ QR Code com link /premio/:codigo
                `}</pre>
              </div>

              <h4 className="font-semibold">4. Fluxo de Campanha WhatsApp</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                <pre>{`
Admin: /admin/robo-whatsapp
  │
  ├─ Cria campanha (whatsapp_campaigns)
  │   ├─ Seleciona público (opt_in, filtros)
  │   └─ Define mensagem/template
  │
  ├─ Gera recipients (whatsapp_campaign_recipients)
  │
  ├─ Edge Function: wa-campaign-run
  │   ├─ Processa em batches
  │   ├─ Chama wa-send para cada mensagem
  │   ├─ Atualiza status do recipient
  │   └─ Respeita rate limits
  │
  └─ Dashboard de acompanhamento em tempo real
                `}</pre>
              </div>

              <h4 className="font-semibold">5. Fluxo Stone TEF</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                <pre>{`
Terminal Stone
  │
  ├─ Webhook POST → Edge Function: stone-webhook
  │   ├─ Valida payload
  │   ├─ Insere em stone_tef_logs
  │   ├─ Busca frentista por terminal_id → frentistas
  │   └─ Tenta vincular a checkin existente
  │
  └─ Admin visualiza em /admin/frentista
                `}</pre>
              </div>
            </div>
          </Section>

          <Section title="Fluxo do Assistente IA" icon={Bot}>
            <div className="bg-muted p-4 rounded-lg font-mono text-xs">
              <pre>{`
Admin: /admin/ai-assistant
  │
  ├─ Input: texto ou voz (Web Speech API)
  │
  ├─ Edge Function: ai-assistant
  │   ├─ Carrega ai_commands do banco
  │   ├─ Carrega contexto: wa_contacts, checkins, promotions
  │   ├─ Chama Lovable AI Gateway (Gemini)
  │   ├─ Extrai action blocks do response
  │   └─ Retorna: { message, action? }
  │
  ├─ Frontend processa action:
  │   ├─ navigate → router.push(route)
  │   ├─ create_promotion → insere em promotions
  │   ├─ run_raffle → trigger raffle_runs
  │   └─ send_whatsapp → chama wa-send
  │
  ├─ Loga em ai_command_logs
  │
  └─ Modo 24h: executa sem confirmação (ai_settings)
              `}</pre>
            </div>
          </Section>
        </TabsContent>

        {/* ========== EDGE FUNCTIONS ========== */}
        <TabsContent value="edge">
          <Section title="Edge Functions (Supabase)" icon={Server}>
            <p>14 edge functions deployadas automaticamente. Todas executam em Deno e usam o Supabase Service Role Key.</p>
            <div className="space-y-4 mt-4">
              {[
                { name: 'ai-assistant', desc: 'Processa comandos do Assistente IA. Chama Lovable AI Gateway, extrai ações e retorna resposta contextualizada.', method: 'POST' },
                { name: 'ai-generate-variations', desc: 'Gera variações de mensagens para campanhas WhatsApp usando IA.', method: 'POST' },
                { name: 'log-cleanup', desc: 'Limpeza periódica de logs antigos (whatsapp_logs, ai_command_logs).', method: 'POST' },
                { name: 'raffle-confirmation', desc: 'Envia WhatsApp de confirmação de participação no sorteio após check-in.', method: 'POST' },
                { name: 'rating-response', desc: 'Processa e responde a avaliações de clientes.', method: 'POST' },
                { name: 'send-whatsapp', desc: 'Envio genérico de WhatsApp (wrapper).', method: 'POST' },
                { name: 'stone-webhook', desc: 'Recebe webhooks da Stone TEF, processa transações, insere em stone_tef_logs.', method: 'POST' },
                { name: 'wa-ai-chatbot', desc: 'Chatbot IA para WhatsApp — responde mensagens recebidas automaticamente.', method: 'POST' },
                { name: 'wa-campaign-run', desc: 'Executa campanha de disparo em massa. Processa recipients em batches com rate limiting.', method: 'POST' },
                { name: 'wa-instance-manage', desc: 'Gerencia instância Evolution API (criar, conectar, status, QR Code).', method: 'POST' },
                { name: 'wa-send', desc: 'Envio unificado de WhatsApp (suporta Evolution e Cloud API).', method: 'POST' },
                { name: 'wa-webhook', desc: 'Recebe webhooks de mensagens WhatsApp (Evolution/Cloud), processa e encaminha ao chatbot.', method: 'POST' },
                { name: 'whatsapp-send', desc: 'Legacy: envio de WhatsApp (mantido para compatibilidade).', method: 'POST' },
                { name: 'whatsapp-test', desc: 'Teste de conectividade WhatsApp.', method: 'POST' },
              ].map((fn) => (
                <div key={fn.name} className="p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="font-mono text-xs">{fn.method}</Badge>
                    <code className="text-sm font-bold text-primary">{fn.name}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">{fn.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Database Functions (RPC)" icon={Database}>
            <div className="space-y-3">
              {[
                { name: 'public_create_checkin_and_token(p_phone, p_attendant_code?, p_tag?)', desc: 'Cria check-in + token público. Faz upsert em wa_contacts. SECURITY DEFINER.' },
                { name: 'get_premio_publico(p_codigo)', desc: 'Retorna dados públicos de um prêmio QR pelo código.' },
                { name: 'abater_com_frentista(p_frentista_nome, p_premio_id, p_valor, p_observacao?)', desc: 'Abate valor de prêmio QR, registra consumo, atualiza saldo.' },
                { name: 'get_public_checkin_status(p_token)', desc: 'Retorna status de um check-in pelo token público.' },
                { name: 'is_admin()', desc: 'Verifica se o usuário atual tem role admin.' },
                { name: 'is_staff()', desc: 'Verifica se o usuário atual tem role admin ou operador.' },
                { name: 'has_role(_user_id, _role)', desc: 'Verifica se um usuário tem determinada role.' },
              ].map((fn) => (
                <div key={fn.name} className="p-3 bg-muted/50 rounded-lg">
                  <code className="text-xs font-bold text-primary block mb-1">{fn.name}</code>
                  <p className="text-sm text-muted-foreground">{fn.desc}</p>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* ========== AUTH & RBAC ========== */}
        <TabsContent value="auth">
          <Section title="Autenticação" icon={Shield}>
            <ul>
              <li><strong>Provider:</strong> Supabase Auth (email + password)</li>
              <li><strong>Login:</strong> /admin/login</li>
              <li><strong>Reset:</strong> /admin/reset (via email)</li>
              <li><strong>Trigger:</strong> on_auth_user_created → cria profile em profiles</li>
              <li><strong>Trigger:</strong> set_admin_for_specific_email → auto-admin para email específico</li>
            </ul>
          </Section>

          <Section title="RBAC (Role-Based Access Control)" icon={Lock}>
            <h4>Roles disponíveis (enum: app_role)</h4>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <Badge className="bg-red-500">admin</Badge>
                <span className="text-sm">Acesso total. Configurações, WhatsApp, IA, Livro Caixa, Integrações.</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <Badge className="bg-blue-500">operador</Badge>
                <span className="text-sm">Operações diárias. Captura, sorteios, promoções, atendimento, relatórios.</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950/20 rounded-lg">
                <Badge variant="secondary">viewer</Badge>
                <span className="text-sm">Somente leitura. Dashboard, manual, dúvidas.</span>
              </div>
            </div>

            <h4>Implementação</h4>
            <ul>
              <li><strong>Tabela:</strong> user_roles (user_id + role)</li>
              <li><strong>Frontend:</strong> AuthContext.tsx → fetchProfileAndRoles() → roles[]</li>
              <li><strong>Frontend Guard:</strong> RoleGuard.tsx com prop requiredRole</li>
              <li><strong>Backend RLS:</strong> Funções is_admin(), is_staff(), has_role()</li>
              <li><strong>Políticas:</strong> Cada tabela tem RLS usando essas funções</li>
            </ul>

            <h4>Fluxo de verificação</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-xs">
              <pre>{`
Requisição → Supabase Auth (JWT) → RLS Policy
  │
  ├─ anon: Apenas SELECT público + INSERT em wa_contacts/checkins
  ├─ authenticated + viewer: Apenas SELECT em tabelas não-restritas  
  ├─ authenticated + operador: is_staff() = true → CRUD operacional
  └─ authenticated + admin: is_admin() = true → Acesso total
              `}</pre>
            </div>
          </Section>
        </TabsContent>

        {/* ========== INTEGRAÇÕES ========== */}
        <TabsContent value="integ">
          <Section title="WhatsApp (Evolution API)" icon={MessageCircle}>
            <ul>
              <li><strong>Provider principal:</strong> Evolution API (self-hosted)</li>
              <li><strong>Secrets:</strong> EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME</li>
              <li><strong>Funcionalidades:</strong> Envio de texto, templates, mídia</li>
              <li><strong>Webhook:</strong> wa-webhook recebe mensagens e status updates</li>
              <li><strong>Chatbot:</strong> wa-ai-chatbot responde automaticamente usando IA</li>
              <li><strong>Campanhas:</strong> wa-campaign-run para disparo em massa</li>
            </ul>
          </Section>

          <Section title="WhatsApp (Cloud API)" icon={MessageCircle}>
            <ul>
              <li><strong>Provider alternativo:</strong> Meta Cloud API (oficial)</li>
              <li><strong>Config:</strong> Armazenada em whatsapp_settings</li>
              <li><strong>Campos:</strong> cloud_access_token, cloud_phone_number_id, cloud_waba_id</li>
              <li><strong>Status:</strong> Configurável via /admin/whatsapp</li>
            </ul>
          </Section>

          <Section title="Stone TEF" icon={CreditCard}>
            <ul>
              <li><strong>Tipo:</strong> Webhook passivo (recebe dados da Stone)</li>
              <li><strong>Edge Function:</strong> stone-webhook</li>
              <li><strong>Dados recebidos:</strong> Valor, forma de pagamento, terminal, NSU, autorização, bandeira</li>
              <li><strong>Vinculação:</strong> Terminal → Frentista (via frentistas.terminal_id)</li>
              <li><strong>Armazenamento:</strong> stone_tef_logs</li>
            </ul>
          </Section>

          <Section title="IA (Lovable AI Gateway)" icon={Bot}>
            <ul>
              <li><strong>Gateway:</strong> https://ai.gateway.lovable.dev/v1/chat/completions</li>
              <li><strong>Modelo:</strong> google/gemini-3-flash-preview</li>
              <li><strong>Secret:</strong> LOVABLE_API_KEY</li>
              <li><strong>Uso:</strong> Assistente IA, chatbot WhatsApp, geração de variações de mensagem</li>
            </ul>
          </Section>

          <Section title="Secrets Configurados" icon={Settings}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
                'SUPABASE_DB_URL', 'SUPABASE_PUBLISHABLE_KEY',
                'LOVABLE_API_KEY', 'OPENAI_API_KEY',
                'EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE_NAME'
              ].map((s) => (
                <div key={s} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                  <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                  <code className="font-mono">{s}</code>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
