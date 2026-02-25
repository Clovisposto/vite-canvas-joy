import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";

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
import AIAssistant from "./pages/admin/AIAssistant";
import Documentacao from "./pages/admin/Documentacao";
import RoleGuard from "./components/RoleGuard";

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
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
              <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/reset" element={<Navigate to="/admin" replace />} />
              
              {/* Admin routes - acesso livre sem autenticação */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/manual" element={<AdminManual />} />
              <Route path="/admin/duvidas" element={<AdminDuvidas />} />
              <Route path="/admin/captura" element={<AdminCaptura />} />
              <Route path="/admin/producao" element={<AdminProducao />} />
              <Route path="/admin/sorteios" element={<AdminSorteios />} />
              <Route path="/admin/historico-sorteios" element={<AdminHistoricoSorteios />} />
              <Route path="/admin/promocoes" element={<AdminPromocoes />} />
              <Route path="/admin/atendimento" element={<AdminAtendimento />} />
              <Route path="/admin/qrcode" element={<AdminQRCode />} />
              <Route path="/admin/qr" element={<AdminQRCode />} />
              <Route path="/admin/frentista" element={<AdminFrentista />} />
              <Route path="/admin/relatorio-frentistas" element={<RelatorioFrentistas />} />
              <Route path="/admin/relatorio-producao" element={<RelatorioProducao />} />
              <Route path="/admin/qr-premiacao" element={<QRPremiacao />} />
              <Route path="/admin/integracoes" element={<AdminIntegracoes />} />
              <Route path="/admin/pontos-captura" element={<PontosCaptura />} />
              <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
              <Route path="/admin/robo-whatsapp" element={<RoboWhatsapp />} />
              <Route path="/admin/configuracoes" element={<AdminConfiguracoes />} />
              <Route path="/admin/livro-caixa" element={<LivroCaixa />} />
              <Route path="/admin/ai-assistant" element={<AIAssistant />} />
              <Route path="/admin/documentacao" element={<Documentacao />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </ErrorBoundary>
  );
}

export default App;
