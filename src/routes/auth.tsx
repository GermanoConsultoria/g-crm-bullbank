import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
});

type FormErrors = Partial<Record<"email" | "password", string>>;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Bem-vindo - BullBank CRM" },
      { name: "description", content: "Acesse o BullBank CRM." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const ensureProfile = async (id: string, fullName: string, userEmail: string) => {
    await supabase.rpc("upsert_profile", {
      p_id: id,
      p_full_name: fullName || userEmail.split("@")[0] || userEmail,
      p_email: userEmail,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await ensureProfile(data.user.id, data.user.user_metadata?.["full_name"] ?? "", email);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0d14]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0d1117] border-r border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-white">
            <img src="/brand/logo-icon.png" alt="BullBank CRM" className="size-6 object-contain" />
          </div>
          <span className="text-white font-semibold tracking-tight">BullBank CRM</span>
        </div>

        <div>
          <blockquote className="text-2xl font-light text-white/80 leading-relaxed mb-6">
            "Gerencie seu funil, acompanhe seus clientes e feche mais negócios."
          </blockquote>
          <div className="flex gap-3">
            {["Clientes", "Funil Kanban", "Comissões", "Relatórios"].map((tag) => (
              <span key={tag} className="text-xs text-blue-400 border border-blue-400/30 rounded-full px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/20">© 2026 BullBank CRM</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img src="/brand/logo-icon.png" alt="BullBank CRM" className="size-5 object-contain" />
            </div>
            <span className="text-white font-semibold">BullBank CRM</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white mb-1">Bem-vindo de volta</h1>
            <p className="text-sm text-white/40">Entre com suas credenciais para continuar.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/70 text-sm">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-blue-500 focus-visible:border-blue-500"
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/70 text-sm">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-blue-500 focus-visible:border-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-white/40 hover:text-white/70"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium h-10 mt-2"
              disabled={loading}
            >
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/30">
            Sua conta é criada por um administrador do CRM.
          </p>
        </div>
      </div>
    </div>
  );
}
