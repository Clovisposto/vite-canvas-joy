import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'staff';
}

/**
 * RoleGuard - Protects routes based on user role
 * - No requiredRole = any authenticated user
 * - 'staff' = admin or operador
 * - 'admin' = admin only
 */
export default function RoleGuard({ children, requiredRole }: RoleGuardProps) {
  const { user, profile, loading, canAccessRoute } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Authenticated but no profile yet - show loading
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check role permissions
  if (!canAccessRoute(requiredRole)) {
    const requiredRoleLabel = requiredRole === 'admin' ? 'Administrador' : 'Administrador ou Operador';
    const currentRoleLabel = profile.role === 'admin' ? 'Administrador' : 
                             profile.role === 'operador' ? 'Operador' : 'Visualizador';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Seu perfil:</strong> {currentRoleLabel}</p>
              <p><strong>Permissão necessária:</strong> {requiredRoleLabel}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Entre em contato com um administrador se você precisar de acesso a esta funcionalidade.
            </p>
            <Button asChild className="w-full">
              <Link to="/admin">Voltar ao Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
