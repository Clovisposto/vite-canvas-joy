import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Gift,
  Percent,
  MessageSquare,
  Upload,
  QrCode,
  BookOpen,
  Settings,
  LogOut,
  Fuel,
  Menu,
  X,
  HelpCircle,
  History,
  MessageCircle,
  CreditCard,
  Star,
  FileBarChart,
  AlertTriangle,
  BookMarked,
  MapPin,
  Bot,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

type RequiredRole = 'admin' | 'staff' | undefined;

interface MenuItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  requiredRole?: RequiredRole; // undefined = any authenticated user
}

const menuItems: MenuItem[] = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/ai-assistant', icon: Bot, label: 'Assistente IA', requiredRole: 'admin' },
  { href: '/admin/captura', icon: Users, label: 'Captura de Cliente', requiredRole: 'staff' },
  { href: '/admin/frentista', icon: CreditCard, label: 'Frentista / Stone', requiredRole: 'staff' },
  { href: '/admin/relatorio-frentistas', icon: FileBarChart, label: 'Relatório Frentistas', requiredRole: 'staff' },
  { href: '/admin/relatorio-producao', icon: BarChart3, label: 'Relatório de Produção', requiredRole: 'staff' },
  { href: '/admin/producao', icon: BarChart3, label: 'Produção', requiredRole: 'staff' },
  { href: '/admin/sorteios', icon: Gift, label: 'Sorteios', requiredRole: 'staff' },
  { href: '/admin/historico-sorteios', icon: History, label: 'Histórico Sorteios', requiredRole: 'staff' },
  { href: '/admin/promocoes', icon: Percent, label: 'Promoções', requiredRole: 'staff' },
  { href: '/admin/atendimento', icon: MessageSquare, label: 'Atendimento', requiredRole: 'staff' },
  { href: '/admin/whatsapp', icon: MessageCircle, label: 'WhatsApp', requiredRole: 'admin' },
  { href: '/admin/robo-whatsapp', icon: Bot, label: 'Robô WhatsApp', requiredRole: 'admin' },
  { href: '/admin/integracoes', icon: Upload, label: 'Integrações', requiredRole: 'admin' },
  { href: '/admin/pontos-captura', icon: MapPin, label: 'Pontos de Captura', requiredRole: 'admin' },
  { href: '/admin/qrcode', icon: QrCode, label: 'QR Code', requiredRole: 'staff' },
  { href: '/admin/qr-premiacao', icon: Gift, label: 'QR Premiação', requiredRole: 'staff' },
  { href: '/admin/livro-caixa', icon: BookMarked, label: 'Livro Caixa', requiredRole: 'admin' },
  { href: '/admin/manual', icon: BookOpen, label: 'Manual/Demo' },
  { href: '/admin/duvidas', icon: HelpCircle, label: 'Dúvidas' },
  { href: '/admin/configuracoes', icon: Settings, label: 'Configurações', requiredRole: 'admin' },
  { href: '/admin/documentacao', icon: FileText, label: 'Documentação', requiredRole: 'admin' },
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, profile, roles, signOut, canAccessRoute } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => canAccessRoute(item.requiredRole));

  // Listen for negative ratings in real-time
  useEffect(() => {
    const channel = supabase
      .channel('negative-ratings-alert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'complaints',
        },
        (payload) => {
          const message = payload.new?.message as string;
          if (message?.includes('Avaliação:')) {
            const match = message.match(/Avaliação: (\d) estrelas/);
            const rating = match ? parseInt(match[1]) : 0;
            
            if (rating > 0 && rating <= 2) {
              const phone = payload.new?.phone as string;
              const maskedPhone = phone ? `****${phone.slice(-4)}` : 'Anônimo';
              
              toast({
                title: (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span>Avaliação Negativa!</span>
                  </div>
                ) as any,
                description: `Cliente ${maskedPhone} avaliou com ${rating} estrela${rating > 1 ? 's' : ''}. Verifique o painel de avaliações.`,
                variant: 'destructive',
                duration: 10000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
            <Fuel className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-sidebar-foreground">Posto 7</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                <Fuel className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-sidebar-foreground">Posto 7</h1>
                <p className="text-xs text-sidebar-foreground/60">Admin</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4 mt-16 lg:mt-0">
            <nav className="px-3 space-y-1">
              {filteredMenuItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User info */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-accent-foreground">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || user?.email}
                </p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">
                  {roles?.[0] || 'viewer'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
