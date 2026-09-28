import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyRole, fetchProfiles, fetchUserRoles, type Profile, type UserRole } from "@/lib/crm";
import { createUserAccount, setUserActive, updateUserAccount } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários" },
      { name: "description", content: "Criação e listagem das contas de acesso ao CRM." },
      { property: "og:title", content: "Usuários" },
      { property: "og:description", content: "Criação e listagem das contas de acesso ao CRM." },
    ],
  }),
  component: UsersPage,
});

const passwordSchema = z.string().min(8, "A senha deve ter no mínimo 8 caracteres.");

const createUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Informe o nome completo."),
    email: z.string().email("E-mail inválido."),
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(["admin", "vendedor"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

const editUserSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome completo."),
  email: z.string().email("E-mail inválido."),
  role: z.enum(["admin", "vendedor"]),
});

type CreateFormErrors = Partial<Record<"fullName" | "email" | "password" | "confirmPassword", string>>;
type EditFormErrors = Partial<Record<"fullName" | "email", string>>;

const emptyForm = { fullName: "", email: "", password: "", confirmPassword: "", role: "vendedor" as UserRole };

function UsersPage() {
  const queryClient = useQueryClient();
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: roles = [] } = useQuery({ queryKey: ["user-roles"], queryFn: fetchUserRoles });
  const { data: currentUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<CreateFormErrors>({});

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", role: "vendedor" as UserRole });
  const [editErrors, setEditErrors] = useState<EditFormErrors>({});

  const isAdmin = role === "admin";
  const roleByUser = new Map<string, UserRole>();
  for (const r of roles) {
    if (r.role === "admin" || !roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
  }

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    queryClient.invalidateQueries({ queryKey: ["user-roles"] });
  };

  const create = useMutation({
    mutationFn: ({ fullName, email, password, role: userRole }: typeof form) =>
      createUserAccount({ data: { fullName, email, password, role: userRole } }),
    onSuccess: () => {
      invalidateUsers();
      toast.success("Conta criada com sucesso.");
      setOpen(false);
      setForm(emptyForm);
      setErrors({});
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: (input: { userId: string; fullName: string; email: string; role: UserRole }) =>
      updateUserAccount({ data: input }),
    onSuccess: () => {
      invalidateUsers();
      toast.success("Usuário atualizado.");
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: (input: { userId: string; active: boolean }) => setUserActive({ data: input }),
    onSuccess: () => {
      invalidateUsers();
      toast.success("Status atualizado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    const result = createUserSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: CreateFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof CreateFormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    create.mutate(form);
  };

  const startEdit = (profile: Profile) => {
    setEditing(profile);
    setEditForm({
      fullName: profile.full_name,
      email: profile.email ?? "",
      role: roleByUser.get(profile.id) ?? "vendedor",
    });
    setEditErrors({});
  };

  const submitEdit = () => {
    const result = editUserSchema.safeParse(editForm);
    if (!result.success) {
      const fieldErrors: EditFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof EditFormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setEditErrors(fieldErrors);
      return;
    }
    setEditErrors({});
    if (!editing) return;
    update.mutate({ userId: editing.id, ...result.data });
  };

  if (!isAdmin) {
    return (
      <AppShell title="Usuários" subtitle="Acesso restrito">
        <div className="panel flex flex-col items-center gap-2 py-16 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Somente administradores podem gerenciar usuários.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Usuários"
      subtitle={`${profiles.length} contas cadastradas`}
      actions={
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setForm(emptyForm);
              setErrors({});
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Criar conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova conta</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Nome do usuário"
                />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="usuario@email.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
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
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select
                  value={form.role}
                  onValueChange={(value: UserRole) => setForm((f) => ({ ...f, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={create.isPending}>
                {create.isPending ? "Criando..." : "Criar conta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {profiles.map((profile) => {
              const isSelf = profile.id === currentUser?.id;
              return (
                <tr key={profile.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{profile.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{profile.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{roleByUser.get(profile.id) ?? "vendedor"}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={profile.is_active}
                      disabled={isSelf || toggleActive.isPending}
                      title={isSelf ? "Você não pode desativar a própria conta." : undefined}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ userId: profile.id, active: checked })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(profile)}>
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma conta cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fullName">Nome completo</Label>
              <Input
                id="edit-fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              {editErrors.fullName && <p className="text-xs text-destructive">{editErrors.fullName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              {editErrors.email && <p className="text-xs text-destructive">{editErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) => setEditForm((f) => ({ ...f, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitEdit} disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
