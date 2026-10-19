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

export type ContactType = "cliente" | "parceiro";

export type Contact = {
  id: string;
  type: ContactType;
  owner_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  // Específicos de cliente.
  lead_type: string | null;
  source: string | null;
  churned_at: string | null;
  churn_reason: string | null;
  // Específicos de parceiro.
  document: string | null;
  segment: string | null;
  specialty: string | null;
  is_active: boolean;
  legacy_form_submission_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Funnel = {
  id: string;
  owner_id: string;
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
  commission_rate: number;
  partner_id: string | null;
  partner_commission_rate: number | null;
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

export const fetchContacts = async () => {
  const data = await unwrap<Contact[]>(supabase.from("contacts").select("*"));
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

export type DealSummary = {
  openCount: number;
  wonCount: number;
  lostCount: number;
  openValue: number;
  wonValue: number;
  /** % de ganhos entre os negócios fechados (ganho + perdido); 0 se nenhum negócio fechado. */
  conversion: number;
};

/**
 * Agrega negócios por status (aberto/ganho/perdido), somando `value` com a
 * mesma coerção Number() usada em todas as telas. Não aplica filtro de
 * período — quem precisar disso (ex: relatorios.tsx) filtra o array antes de
 * chamar esta função, preservando o comportamento de cada tela.
 */
export function summarizeDeals(deals: Deal[], options: { ownerId?: string } = {}): DealSummary {
  const scoped =
    options.ownerId !== undefined ? deals.filter((d) => d.owner_id === options.ownerId) : deals;
  const open = scoped.filter((d) => d.status === "aberto");
  const won = scoped.filter((d) => d.status === "ganho");
  const lost = scoped.filter((d) => d.status === "perdido");
  const closed = won.length + lost.length;
  return {
    openCount: open.length,
    wonCount: won.length,
    lostCount: lost.length,
    openValue: open.reduce((sum, d) => sum + Number(d.value), 0),
    wonValue: won.reduce((sum, d) => sum + Number(d.value), 0),
    conversion: closed > 0 ? (won.length / closed) * 100 : 0,
  };
}

/** Comissão = soma de (valor × taxa própria) de cada negócio ganho do vendedor. */
export function commissionFor(deals: Deal[], profile: Profile) {
  const { wonCount, wonValue } = summarizeDeals(deals, { ownerId: profile.id });
  const commission = deals
    .filter((d) => d.owner_id === profile.id && d.status === "ganho")
    .reduce((sum, d) => sum + (Number(d.value) * Number(d.commission_rate)) / 100, 0);
  return {
    wonCount,
    total: wonValue,
    commission,
    goalProgress:
      profile.monthly_goal > 0 ? Math.min(100, (wonValue / profile.monthly_goal) * 100) : 0,
  };
}

/** Comissão do parceiro indicador = soma de (valor × taxa própria) dos negócios ganhos que ele indicou. */
export function partnerCommissionFor(deals: Deal[], partnerId: string) {
  const won = deals.filter((d) => d.partner_id === partnerId && d.status === "ganho");
  return {
    wonCount: won.length,
    total: won.reduce((sum, d) => sum + Number(d.value), 0),
    commission: won.reduce(
      (sum, d) => sum + (Number(d.value) * Number(d.partner_commission_rate ?? 0)) / 100,
      0,
    ),
  };
}

export type Period = "semana" | "mes" | "ano";

/** Filtra negócios por período de referência (`closed_at ?? created_at`). Usada em relatorios.tsx. */
export function filterByPeriod(deals: Deal[], period: Period): Deal[] {
  const now = new Date();
  return deals.filter((d) => {
    const ref = d.closed_at ?? d.created_at;
    const date = new Date(ref);
    if (period === "semana") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    }
    if (period === "mes") {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }
    // ano
    return date.getFullYear() === now.getFullYear();
  });
}

/** Início do período (mesmos limites de filterByPeriod), usado por churnFor(). */
function periodStart(period: Period): Date {
  const now = new Date();
  if (period === "semana") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return weekAgo;
  }
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1); // ano
}

/** Cliente ativo = tem pelo menos um negócio ganho vinculado e não cancelou. */
export function isActiveClient(contact: Contact, deals: Deal[]) {
  return (
    contact.type === "cliente" &&
    !contact.churned_at &&
    deals.some((d) => d.client_id === contact.id && d.status === "ganho")
  );
}

export type ChurnSummary = {
  activeAtStart: number;
  churned: number;
  rate: number;
  churnedClients: {
    id: string;
    name: string;
    company: string | null;
    churned_at: string;
    churn_reason: string | null;
    wonValue: number;
  }[];
};

/**
 * Taxa de churn do período = cancelados no período / clientes que já estavam
 * ativos no início do período. "Ativo no início do período" = o primeiro
 * negócio ganho dele fechou antes do início do período, e ele não tinha
 * cancelado ainda (churned_at nulo, ou cancelou dentro/depois do período).
 */
export function churnFor(contacts: Contact[], deals: Deal[], period: Period): ChurnSummary {
  const start = periodStart(period);
  const clients = contacts.filter((c) => c.type === "cliente");

  const wonValueFor = (clientId: string) =>
    deals
      .filter((d) => d.client_id === clientId && d.status === "ganho")
      .reduce((sum, d) => sum + Number(d.value), 0);

  const activationDate = (clientId: string): Date | null => {
    const won = deals.filter((d) => d.client_id === clientId && d.status === "ganho");
    if (won.length === 0) return null;
    const earliest = Math.min(...won.map((d) => new Date(d.closed_at ?? d.created_at).getTime()));
    return new Date(earliest);
  };

  let activeAtStart = 0;
  const churnedClients: ChurnSummary["churnedClients"] = [];

  for (const client of clients) {
    const activatedAt = activationDate(client.id);
    if (!activatedAt || activatedAt >= start) continue;

    const churnedAt = client.churned_at ? new Date(client.churned_at) : null;
    if (churnedAt && churnedAt < start) continue; // já tinha cancelado antes do período começar

    activeAtStart += 1;
    if (churnedAt) {
      churnedClients.push({
        id: client.id,
        name: client.name,
        company: client.company,
        churned_at: client.churned_at!,
        churn_reason: client.churn_reason,
        wonValue: wonValueFor(client.id),
      });
    }
  }

  return {
    activeAtStart,
    churned: churnedClients.length,
    rate: activeAtStart > 0 ? (churnedClients.length / activeAtStart) * 100 : 0,
    churnedClients,
  };
}
