import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Apenas administradores podem gerenciar usuários.");
}

const createUserSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "vendedor"]),
});

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError) throw new Error(createError.message);

    const userId = created.user?.id;
    if (!userId) throw new Error("Falha ao criar usuário.");

    // O trigger on_auth_user_created já grava o papel 'vendedor'; promove para admin quando solicitado.
    if (data.role === "admin") {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", userId);
      if (roleError) throw new Error(roleError.message);
    }

    // Admin conhece a senha inicial: exige troca no primeiro login do usuário.
    const { error: forceChangeError } = await supabaseAdmin
      .from("profiles")
      .update({ force_password_change: true })
      .eq("id", userId);
    if (forceChangeError) throw new Error(forceChangeError.message);

    return { id: userId };
  });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "vendedor"]),
});

export const updateUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, email: data.email })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    // Garante exatamente um papel por usuário (auto-corrige duplicatas legadas).
    const { error: deleteRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteRolesError) throw new Error(deleteRolesError.message);

    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertRoleError) throw new Error(insertRoleError.message);

    return { id: data.userId };
  });

const setUserActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => setUserActiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    if (data.userId === context.userId) {
      throw new Error("Você não pode desativar sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (banError) throw new Error(banError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    return { id: data.userId, active: data.active };
  });
