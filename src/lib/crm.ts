import { supabase } from "@/integrations/supabase/client";
import type { FormSubmissionType } from "@/lib/form-templates";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  commission_rate: number;
  monthly_goal: number;
  is_active: boolean;
  force_password_change: boolean;
};

export type Client = {
  id: string;
  owner_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  lead_type: string;
  source: string | null;
  notes: string | null;
  created_at: string;
};

export type Funnel = {
  id: string;
  name: string;
  position: number;
};

export type Stage = {
  id: string;
  funnel_id: string;
  name: string;
  position: number;
  color: string;
};

export type LeadType = {
  id: string;
  name: string;
  position: number;
};

export type Deal = {
  id: string;
  owner_id: string;
  client_id: string | null;
  stage_id: string | null;
  title: string;
  value: number;
  status: string;
  lead_type: string;
  closed_at: string | null;
  created_at: string;
};

export type FormSubmission = {
  id: string;
  owner_id: string;
  type: FormSubmissionType;
  name: string;
  company: string | null;
  data: Record<string, string>;
  created_at: string;
};

export type Task = {
  id: string;
  owner_id: string;
  deal_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  done: boolean;
  completed_at: string | null;
  created_at: string;
};

export const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

export const shortDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value)) : "—";

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Resposta inesperada do banco: dados nulos.");
  return data as T;
}

export const fetchProfiles = () =>
  unwrap<Profile[]>(supabase.from("profiles").select("*").order("full_name"));

export const fetchClients = async () => {
  const data = await unwrap<Client[]>(supabase.from("clients").select("*"));
  return [...data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
};

export const fetchFunnels = async () => {
  const data = await unwrap<Funnel[]>(supabase.from("funnels").select("*").order("position"));
  return [...data].sort((a, b) => a.position - b.position);
};

export const fetchStages = () =>
  unwrap<Stage[]>(supabase.from("stages").select("*").order("position"));

export const fetchLeadTypes = async () => {
  const data = await unwrap<LeadType[]>(supabase.from("lead_types").select("*"));
  return [...data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
};

export const fetchDeals = () =>
  unwrap<Deal[]>(supabase.from("deals").select("*").order("created_at", { ascending: false }));

export const fetchTasks = () =>
  unwrap<Task[]>(supabase.from("tasks").select("*").order("due_date", { ascending: true }));

export const fetchFormSubmissions = async () => {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FormSubmission[];
};

export type UserRole = "admin" | "vendedor";

export const fetchUserRoles = () =>
  unwrap<{ user_id: string; role: UserRole }[]>(supabase.from("user_roles").select("user_id, role"));

export const fetchMyRole = async () => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).limit(1);
  return (data?.[0]?.role as string | undefined) ?? "vendedor";
};

/** Comissão = taxa configurada do vendedor aplicada sobre os negócios ganhos. */
export function commissionFor(deals: Deal[], profile: Profile) {
  const won = deals.filter((d) => d.owner_id === profile.id && d.status === "ganho");
  const total = won.reduce((sum, d) => sum + Number(d.value), 0);
  return {
    wonCount: won.length,
    total,
    commission: (total * Number(profile.commission_rate)) / 100,
    goalProgress: profile.monthly_goal > 0 ? Math.min(100, (total / profile.monthly_goal) * 100) : 0,
  };
}
