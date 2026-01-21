import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, LockKeyhole, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const schema = z
  .object({
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [data, setData] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Redefinir senha do Admin | Posto 7";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(!!data.session);
      setLoading(false);
    };

    // Listener para pegar sessão quando o usuário chega via link de recuperação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setLoading(false);
    });

    sync();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const canSubmit = useMemo(() => {
    return hasSession && !saving && data.password.length >= 6 && data.confirmPassword.length >= 6;
  }, [hasSession, saving, data.password, data.confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setSaving(false);

    if (error) {
      toast({
        title: "Não foi possível redefinir a senha",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Senha atualizada",
      description: "Agora você pode acessar o Painel Admin.",
    });

    navigate("/admin", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <section className="w-full max-w-md">
        <Link
          to="/admin/login"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao login
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LockKeyhole className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>
              {hasSession
                ? "Defina uma nova senha para acessar o Painel Admin."
                : "Abra novamente o link de recuperação enviado para seu email."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••"
                  value={data.password}
                  onChange={(e) => setData((d) => ({ ...d, password: e.target.value }))}
                  disabled={!hasSession || saving}
                />
                {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••"
                  value={data.confirmPassword}
                  onChange={(e) => setData((d) => ({ ...d, confirmPassword: e.target.value }))}
                  disabled={!hasSession || saving}
                />
                {errors.confirmPassword ? (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Atualizar senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
