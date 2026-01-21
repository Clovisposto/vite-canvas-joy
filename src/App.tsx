import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Public pages
import CustomerApp from "./pages/CustomerApp";
import AbastecimentoStatus from "./pages/AbastecimentoStatus";
import NotFound from "./pages/NotFound";
// Admin pages
import AdminLogin from "./pages/admin/Login";
import AdminResetPassword from "./pages/admin/ResetPassword";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCaptura from "./pages/admin/Captura";
import AdminProducao from "./pages/admin/Producao";
import AdminSorteios from "./pages/admin/Sorteios";
import AdminHistoricoSorteios from "./pages/admin/HistoricoSorteios";
import AdminPromocoes from "./pages/admin/Promocoes";
import AdminAtendimento from "./pages/admin/Atendimento";
// AdminAvaliacoes removido
import AdminIntegracoes from "./pages/admin/Integracoes";
import AdminQRCode from "./pages/admin/QRCode";
import AdminManual from "./pages/admin/Manual";
import AdminDuvidas from "./pages/admin/Duvidas";
import AdminConfiguracoes from "./pages/admin/Configuracoes";
import AdminWhatsApp from "./pages/admin/WhatsApp";
import AdminFrentista from "./pages/admin/Frentista";
import RelatorioFrentistas from "./pages/admin/RelatorioFrentistas";
import RelatorioProducao from "./pages/admin/RelatorioProducao";
import LivroCaixa from "./pages/admin/LivroCaixa";
import PontosCaptura from "./pages/admin/PontosCaptura";
import QRPremiacao from "./pages/admin/QRPremiacao";
import PremioValidacao from "./pages/PremioValidacao";
import RoboWhatsapp from "./pages/admin/RoboWhatsapp";
import RoleGuard from "./components/RoleGuard";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Rota raiz redireciona para /aplicativo */}
              <Route path="/" element={<Navigate to="/aplicativo" replace />} />
              <Route path="/aplicativo" element={<CustomerApp />} />
              <Route path="/app" element={<Navigate to="/aplicativo" replace />} />
              <Route path="/abastecimento/:token" element={<AbastecimentoStatus />} />
              <Route path="/premio/:codigo" element={<PremioValidacao />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/reset" element={<AdminResetPassword />} />
              
              {/* Protected admin routes - Dashboard accessible to all authenticated */}
              <Route path="/admin" element={<RoleGuard><AdminDashboard /></RoleGuard>} />
              <Route path="/admin/manual" element={<RoleGuard><AdminManual /></RoleGuard>} />
              <Route path="/admin/duvidas" element={<RoleGuard><AdminDuvidas /></RoleGuard>} />
              
              {/* Staff routes (admin + operador) */}
              <Route path="/admin/captura" element={<RoleGuard requiredRole="staff"><AdminCaptura /></RoleGuard>} />
              <Route path="/admin/producao" element={<RoleGuard requiredRole="staff"><AdminProducao /></RoleGuard>} />
              <Route path="/admin/sorteios" element={<RoleGuard requiredRole="staff"><AdminSorteios /></RoleGuard>} />
              <Route path="/admin/historico-sorteios" element={<RoleGuard requiredRole="staff"><AdminHistoricoSorteios /></RoleGuard>} />
              <Route path="/admin/promocoes" element={<RoleGuard requiredRole="staff"><AdminPromocoes /></RoleGuard>} />
              <Route path="/admin/atendimento" element={<RoleGuard requiredRole="staff"><AdminAtendimento /></RoleGuard>} />
              {/* Rota de avaliações removida */}
              <Route path="/admin/qrcode" element={<RoleGuard requiredRole="staff"><AdminQRCode /></RoleGuard>} />
              <Route path="/admin/qr" element={<RoleGuard requiredRole="staff"><AdminQRCode /></RoleGuard>} />
              <Route path="/admin/frentista" element={<RoleGuard requiredRole="staff"><AdminFrentista /></RoleGuard>} />
              <Route path="/admin/relatorio-frentistas" element={<RoleGuard requiredRole="staff"><RelatorioFrentistas /></RoleGuard>} />
              <Route path="/admin/relatorio-producao" element={<RoleGuard requiredRole="staff"><RelatorioProducao /></RoleGuard>} />
              <Route path="/admin/qr-premiacao" element={<RoleGuard requiredRole="staff"><QRPremiacao /></RoleGuard>} />
              
              {/* Admin-only routes */}
              <Route path="/admin/integracoes" element={<RoleGuard requiredRole="admin"><AdminIntegracoes /></RoleGuard>} />
              <Route path="/admin/pontos-captura" element={<RoleGuard requiredRole="admin"><PontosCaptura /></RoleGuard>} />
              <Route path="/admin/whatsapp" element={<RoleGuard requiredRole="admin"><AdminWhatsApp /></RoleGuard>} />
              <Route path="/admin/robo-whatsapp" element={<RoleGuard requiredRole="admin"><RoboWhatsapp /></RoleGuard>} />
              <Route path="/admin/configuracoes" element={<RoleGuard requiredRole="admin"><AdminConfiguracoes /></RoleGuard>} />
              <Route path="/admin/livro-caixa" element={<RoleGuard requiredRole="admin"><LivroCaixa /></RoleGuard>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
