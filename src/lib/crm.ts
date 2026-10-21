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

/**
 * Filtra só perfis sem role "admin" — usado pra tirar o admin das listas de
 * desempenho/comissão/metas, que são sobre quem vende, não quem administra.
 * Checa presença de 'admin' (como has_role() no banco), em vez de pegar "a"
 * role do usuário — um usuário não devia ter mais de uma linha em
 * user_roles, mas se algum bug de novo deixar (como upsert_profile() já
 * deixou — ver 20261019160000_fix_upsert_profile_role.sql), ter uma role
 * 'admin' deve bastar pra ser tratado como admin de qualquer forma.
 */
export function onlySellers<T extends { id: string }>(
  profiles: T[],
  userRoles: { user_id: string; role: UserRole }[],
): T[] {
  const adminIds = new Set(userRoles.filter((r) => r.role === "admin").map((r) => r.user_id));
  return profiles.filter((p) => !adminIds.has(p.id));
}

/**
 * Perfis visíveis dado um vendorId: um vendedor específico (filtrado de
 * sellerProfiles, já sem admin), OU — quando vendorId é o do próprio usuário
 * logado (o admin "se vendo como vendedor" na seção "Minhas vendas") — o
 * perfil dele mesmo direto de rawProfiles, ignorando a exclusão de
 * onlySellers() só nesse caso específico.
 */
export function profilesForVendor<T extends { id: string }>(
  rawProfiles: T[],
  sellerProfiles: T[],
  vendorId: string | undefined,
  selfId: string | undefined,
): T[] {
  if (!vendorId) return sellerProfiles;
  if (vendorId === selfId) return rawProfiles.filter((p) => p.id === vendorId);
  return sellerProfiles.filter((p) => p.id === vendorId);
}

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

export type ClientVolumeMonth = {
  month: string;
  label: string;
  value: number;
  count: number;
  cumulative: number;
  churned?: boolean;
};
export type ClientVolume = {
  wonCount: number;
  total: number;
  months: ClientVolumeMonth[];
  churnedMonth?: string;
};

// Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }) gera "jan. de 26",
// "fev. de 26" etc. — verboso demais pro eixo X do gráfico (as labels se sobrepõem e
// na prática só se lê "de 26" em todo ponto). Por isso o formato curto "mmm/aa" manual.
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (year: number, monthIndex: number) =>
  `${MONTH_ABBR[monthIndex]}/${String(year).slice(-2)}`;

const monthKeyOf = (value: string) => {
  const ref = new Date(value);
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Volume comprado por um cliente = negócios ganhos dele, agrupados por mês
 * (closed_at ?? created_at, igual a filterByPeriod) com total acumulado mês a
 * mês — a "curva de crescimento" usada no gráfico de evolução. Se `churnedAt`
 * for informado, o mês do cancelamento entra na linha do tempo (com valor 0
 * quando não houver compra nesse mês) para marcar o ponto no gráfico.
 */
export function clientVolumeFor(
  deals: Deal[],
  clientId: string,
  churnedAt?: string | null,
): ClientVolume {
  const won = deals.filter((d) => d.client_id === clientId && d.status === "ganho");

  const byMonth = new Map<string, { total: number; count: number }>();
  for (const d of won) {
    const key = monthKeyOf(d.closed_at ?? d.created_at);
    const entry = byMonth.get(key) ?? { total: 0, count: 0 };
    entry.total += Number(d.value);
    entry.count += 1;
    byMonth.set(key, entry);
  }

  const churnedMonth = churnedAt ? monthKeyOf(churnedAt) : undefined;
  if (churnedMonth && !byMonth.has(churnedMonth)) byMonth.set(churnedMonth, { total: 0, count: 0 });

  let cumulative = 0;
  const months = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, count }]) => {
      cumulative += total;
      const year = Number(month.slice(0, 4));
      const m = Number(month.slice(5, 7));
      return {
        month,
        label: monthLabel(year, m - 1),
        value: total,
        count,
        cumulative,
        churned: month === churnedMonth,
      };
    });

  const result: ClientVolume = {
    wonCount: won.length,
    total: won.reduce((sum, d) => sum + Number(d.value), 0),
    months,
  };
  if (churnedMonth) result.churnedMonth = churnedMonth;
  return result;
}

export type ClientVolumeDay = {
  day: string;
  label: string;
  value: number;
  count: number;
  cumulative: number;
  churned?: boolean;
};

/**
 * Mesma lógica de clientVolumeFor(), mas restrita a um mês (year/month, 1-12)
 * e agrupada por dia — usada na visão "Mês" do gráfico de evolução, pro
 * acumulado começar do zero dentro do mês selecionado.
 */
export function clientVolumeByDayFor(
  deals: Deal[],
  clientId: string,
  year: number,
  month: number,
  churnedAt?: string | null,
): ClientVolumeDay[] {
  const won = deals.filter((d) => d.client_id === clientId && d.status === "ganho");

  const byDay = new Map<number, { total: number; count: number }>();
  for (const d of won) {
    const ref = new Date(d.closed_at ?? d.created_at);
    if (ref.getFullYear() !== year || ref.getMonth() + 1 !== month) continue;
    const day = ref.getDate();
    const entry = byDay.get(day) ?? { total: 0, count: 0 };
    entry.total += Number(d.value);
    entry.count += 1;
    byDay.set(day, entry);
  }

  let churnedDay: number | undefined;
  if (churnedAt) {
    const ref = new Date(churnedAt);
    if (ref.getFullYear() === year && ref.getMonth() + 1 === month) {
      churnedDay = ref.getDate();
      if (!byDay.has(churnedDay)) byDay.set(churnedDay, { total: 0, count: 0 });
    }
  }

  let cumulative = 0;
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, { total, count }]) => {
      cumulative += total;
      const label = String(day).padStart(2, "0");
      return { day: label, label, value: total, count, cumulative, churned: day === churnedDay };
    });
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

type ChurnedClient = {
  id: string;
  name: string;
  company: string | null;
  churned_at: string;
  churn_reason: string | null;
  wonValue: number;
};

export type ChurnSummary = {
  activeAtStart: number;
  churned: number;
  rate: number;
  churnedClients: ChurnedClient[];
  /**
   * Cancelou dentro do período, mas ativou (primeiro negócio ganho) também
   * dentro do mesmo período — por isso não entra no cálculo da taxa (não
   * estava "ativo no início do período"). Listado à parte pra esse
   * cancelamento não sumir silenciosamente do relatório.
   */
  excludedChurn: ChurnedClient[];
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
  const churnedClients: ChurnedClient[] = [];
  const excludedChurn: ChurnedClient[] = [];

  for (const client of clients) {
    const activatedAt = activationDate(client.id);
    const churnedAt = client.churned_at ? new Date(client.churned_at) : null;

    if (!activatedAt || activatedAt >= start) {
      // Ativou dentro do próprio período (ou nunca ativou): não conta como
      // "ativo no início". Se além disso já cancelou dentro do período,
      // registra à parte em vez de deixar o cancelamento invisível.
      if (churnedAt && churnedAt >= start) {
        excludedChurn.push({
          id: client.id,
          name: client.name,
          company: client.company,
          churned_at: client.churned_at!,
          churn_reason: client.churn_reason,
          wonValue: wonValueFor(client.id),
        });
      }
      continue;
    }

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
    excludedChurn,
  };
}
