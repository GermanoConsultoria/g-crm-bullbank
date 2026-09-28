import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const schema = z
  .object({
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

type FormErrors = Partial<Record<"password" | "confirmPassword", string>>;

export function ForcePasswordDialog({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const result = schema.safeParse({ password, confirmPassword });
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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ force_password_change: false })
        .eq("id", userId);
      if (profileError) throw profileError;

      await supabase.auth.signOut();
      toast.success("Senha atualizada. Faça login com a nova senha.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="[&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Defina uma nova senha</DialogTitle>
          <DialogDescription>
            Por segurança, cadastre uma nova senha, conhecida só por você, antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-password">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
