import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  churnFor,
  clientVolumeFor,
  commissionFor,
  filterByPeriod,
  isActiveClient,
  partnerCommissionFor,
  summarizeDeals,
  type Contact,
  type Deal,
  type Profile,
} from "@/lib/crm";

// Fixture comum: negócios de dois vendedores, com um pouco de tudo
// (aberto/ganho/perdido, valores numéricos e em string, datas distintas)
// para exercitar os mesmos casos que as telas reais encontram.
const profileA: Profile = {
  id: "seller-a",
  full_name: "Vendedor A",
  email: "a@example.com",
  commission_rate: 10,
  monthly_goal: 1000,
  is_active: true,
  force_password_change: false,
};

const profileB: Profile = {
  id: "seller-b",
  full_name: "Vendedor B",
  email: "b@example.com",
  commission_rate: 5,
  monthly_goal: 0,
  is_active: true,
  force_password_change: false,
};

function deal(partial: Partial<Deal> & { id: string; owner_id: string }): Deal {
  return {
    client_id: null,
    stage_id: null,
    title: "Negócio",
    value: 0,
    status: "aberto",
    lead_type: "Indicação",
    commission_rate: 0,
    partner_id: null,
    partner_commission_rate: null,
    closed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

// commission_rate dos negócios ganhos replica a taxa do vendedor (10% pra
// seller-a, 5% pra seller-b) pra manter os totais de comissão esperados
// abaixo — exatamente o que a migration de backfill faz em produção.
const deals: Deal[] = [
  deal({ id: "d1", owner_id: "seller-a", status: "ganho", value: 300, commission_rate: 10 }),
  deal({ id: "d2", owner_id: "seller-a", status: "ganho", value: 200, commission_rate: 10 }),
  deal({ id: "d3", owner_id: "seller-a", status: "perdido", value: 999 }),
  deal({ id: "d4", owner_id: "seller-a", status: "aberto", value: 150 }),
  deal({ id: "d5", owner_id: "seller-b", status: "ganho", value: 400, commission_rate: 5 }),
  // value como string (vem do input de formulário sem coerção prévia em alguns pontos)
  deal({
    id: "d6",
    owner_id: "seller-b",
    status: "ganho",
    value: "100" as unknown as number,
    commission_rate: 5,
  }),
];

describe("commissionFor() — comissão por taxa própria de cada negócio", () => {
  it("soma apenas os negócios ganhos do próprio vendedor", () => {
    const stats = commissionFor(deals, profileA);
    expect(stats.wonCount).toBe(2);
    expect(stats.total).toBe(500); // 300 + 200, ignora perdido/aberto e o outro vendedor
  });

  it("calcula a comissão somando valor × taxa de cada negócio ganho", () => {
    const stats = commissionFor(deals, profileA);
    expect(stats.commission).toBe(50); // 300*10% + 200*10%
  });

  it("negócios do mesmo vendedor com taxas diferentes não usam uma taxa única", () => {
    const mix = [
      deal({ id: "x1", owner_id: "seller-a", status: "ganho", value: 100, commission_rate: 10 }),
      deal({ id: "x2", owner_id: "seller-a", status: "ganho", value: 100, commission_rate: 20 }),
    ];
    // profile.commission_rate (10) é ignorado pro cálculo — cada negócio usa a própria taxa.
    expect(commissionFor(mix, profileA).commission).toBe(30); // 100*10% + 100*20%
  });

  it("soma valores em string via coerção Number()", () => {
    const stats = commissionFor(deals, profileB);
    expect(stats.total).toBe(500); // 400 + Number("100")
    expect(stats.commission).toBe(25); // 400*5% + 100*5%
  });

  it("não aplica filtro de período — soma o histórico completo do vendedor", () => {
    const antigo = deal({
      id: "d-antigo",
      owner_id: "seller-a",
      status: "ganho",
      value: 1000,
      closed_at: "2020-01-01T00:00:00.000Z",
    });
    const stats = commissionFor([...deals, antigo], profileA);
    // Pendência de negócio registrada na Fase 0: commissionFor nunca filtrou
    // por período, mesmo o nome do campo sendo "monthly_goal". Preservado de propósito.
    expect(stats.total).toBe(1500);
  });

  it("goalProgress é 0 quando monthly_goal é 0, mesmo havendo receita", () => {
    const stats = commissionFor(deals, profileB);
    expect(stats.goalProgress).toBe(0);
  });

  it("goalProgress é travado em 100 quando o total ganho supera a meta", () => {
    const stats = commissionFor(deals, profileA); // total 500, meta 1000 -> 50%
    expect(stats.goalProgress).toBe(50);

    const metaBaixa: Profile = { ...profileA, monthly_goal: 100 };
    expect(commissionFor(deals, metaBaixa).goalProgress).toBe(100); // travado, não 500%
  });

  it("retorna zero em todos os campos quando o vendedor não tem negócios", () => {
    const semNegocios: Profile = { ...profileA, id: "seller-sem-negocio" };
    const stats = commissionFor(deals, semNegocios);
    expect(stats).toEqual({ wonCount: 0, total: 0, commission: 0, goalProgress: 0 });
  });

  it("retorna zero com array de negócios vazio", () => {
    const stats = commissionFor([], profileA);
    expect(stats).toEqual({ wonCount: 0, total: 0, commission: 0, goalProgress: 0 });
  });
});

describe("partnerCommissionFor() — comissão do parceiro indicador", () => {
  const comParceiro: Deal[] = [
    deal({
      id: "p1",
      owner_id: "seller-a",
      status: "ganho",
      value: 1000,
      partner_id: "partner-1",
      partner_commission_rate: 5,
    }),
    deal({
      id: "p2",
      owner_id: "seller-b",
      status: "ganho",
      value: 500,
      partner_id: "partner-1",
      partner_commission_rate: 5,
    }),
    // mesmo parceiro, negócio ainda aberto — não entra na comissão.
    deal({ id: "p3", owner_id: "seller-a", status: "aberto", value: 2000, partner_id: "partner-1" }),
    // outro parceiro, não deve contar pra partner-1.
    deal({
      id: "p4",
      owner_id: "seller-a",
      status: "ganho",
      value: 1000,
      partner_id: "partner-2",
      partner_commission_rate: 50,
    }),
  ];

  it("soma valor × taxa só dos negócios ganhos indicados por aquele parceiro", () => {
    const stats = partnerCommissionFor(comParceiro, "partner-1");
    expect(stats.wonCount).toBe(2);
    expect(stats.total).toBe(1500); // 1000 + 500, ignora o aberto e o outro parceiro
    expect(stats.commission).toBe(75); // 1000*5% + 500*5%
  });

  it("negócio sem parceiro indicador não entra em nenhum total", () => {
    const semParceiro = deal({ id: "p5", owner_id: "seller-a", status: "ganho", value: 999 });
    const stats = partnerCommissionFor([...comParceiro, semParceiro], "partner-1");
    expect(stats.total).toBe(1500);
  });

  it("retorna zero quando o parceiro não aparece em nenhum negócio", () => {
    expect(partnerCommissionFor(comParceiro, "partner-sem-negocio")).toEqual({
      wonCount: 0,
      total: 0,
      commission: 0,
    });
  });
});

describe("clientVolumeFor() — total comprado e evolução mensal de um cliente", () => {
  it("retorna zerado quando o cliente não tem nenhum negócio ganho", () => {
    const result = clientVolumeFor(deals, "cliente-sem-negocio");
    expect(result).toEqual({ wonCount: 0, total: 0, months: [] });
  });

  it("agrupa por mês (closed_at ?? created_at) e acumula o total mês a mês", () => {
    const porCliente: Deal[] = [
      deal({
        id: "v1",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        value: 100,
        closed_at: "2026-01-10T00:00:00.000Z",
      }),
      deal({
        id: "v2",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        value: 50,
        closed_at: "2026-01-20T00:00:00.000Z",
      }),
      deal({
        id: "v3",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        value: 200,
        closed_at: "2026-02-05T00:00:00.000Z",
      }),
    ];
    const result = clientVolumeFor(porCliente, "c1");
    expect(result.wonCount).toBe(3);
    expect(result.total).toBe(350);
    expect(result.months.map((m) => [m.month, m.value, m.cumulative])).toEqual([
      ["2026-01", 150, 150],
      ["2026-02", 200, 350],
    ]);
  });

  it("ignora negócios abertos/perdidos e de outros clientes", () => {
    const porCliente: Deal[] = [
      deal({ id: "v1", owner_id: "seller-a", client_id: "c1", status: "ganho", value: 100 }),
      deal({ id: "v2", owner_id: "seller-a", client_id: "c1", status: "aberto", value: 999 }),
      deal({ id: "v3", owner_id: "seller-a", client_id: "c1", status: "perdido", value: 999 }),
      deal({
        id: "v4",
        owner_id: "seller-a",
        client_id: "outro-cliente",
        status: "ganho",
        value: 999,
      }),
    ];
    expect(clientVolumeFor(porCliente, "c1").total).toBe(100);
  });

  it("cai para created_at quando closed_at é null, igual a filterByPeriod", () => {
    const sem = deal({
      id: "v1",
      owner_id: "seller-a",
      client_id: "c1",
      status: "ganho",
      value: 100,
      closed_at: null,
      created_at: "2026-03-15T00:00:00.000Z",
    });
    expect(clientVolumeFor([sem], "c1").months.map((m) => m.month)).toEqual(["2026-03"]);
  });
});

describe("summarizeDeals() — reproduz as fórmulas de cada tela", () => {
  it("sem ownerId: soma todos os vendedores (igual ao card 'Receita ganha' de comissoes.tsx)", () => {
    const summary = summarizeDeals(deals);
    expect(summary).toEqual({
      openCount: 1,
      wonCount: 4,
      lostCount: 1,
      openValue: 150,
      wonValue: 1000,
      conversion: 80,
    });
  });

  it("com ownerId: reproduz o total ganho por vendedor usado em commissionFor/dashboard", () => {
    expect(summarizeDeals(deals, { ownerId: "seller-a" }).wonValue).toBe(500);
    expect(summarizeDeals(deals, { ownerId: "seller-b" }).wonValue).toBe(500);
  });

  it("array vazio retorna todos os campos zerados", () => {
    expect(summarizeDeals([])).toEqual({
      openCount: 0,
      wonCount: 0,
      lostCount: 0,
      openValue: 0,
      wonValue: 0,
      conversion: 0,
    });
  });

  it("ownerId sem nenhum negócio correspondente retorna zerado, não undefined/NaN", () => {
    expect(summarizeDeals(deals, { ownerId: "sem-negocios" })).toEqual({
      openCount: 0,
      wonCount: 0,
      lostCount: 0,
      openValue: 0,
      wonValue: 0,
      conversion: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Réplicas fiéis das fórmulas hoje inline em dashboard.tsx, relatorios.tsx e
// comissoes.tsx (ainda não extraídas para uma função compartilhada). Servem
// de "golden values" para validar summarizeDeals() depois do refactor: se os
// números abaixo continuarem idênticos quando trocarmos a implementação para
// usar summarizeDeals(), a refatoração preservou o comportamento.
// ---------------------------------------------------------------------------

describe("dashboard.tsx — fórmulas atuais (réplica fiel, pré-refactor)", () => {
  // Espelha dashboard.tsx:46-51
  function dashboardKpis(scopedDeals: Deal[]) {
    const open = scopedDeals.filter((d) => d.status === "aberto");
    const won = scopedDeals.filter((d) => d.status === "ganho");
    const lost = scopedDeals.filter((d) => d.status === "perdido");
    const openValue = open.reduce((s, d) => s + Number(d.value), 0);
    const wonValue = won.reduce((s, d) => s + Number(d.value), 0);
    const conversion =
      won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;
    return {
      openCount: open.length,
      wonCount: won.length,
      lostCount: lost.length,
      openValue,
      wonValue,
      conversion,
    };
  }

  it("calcula pipeline/ganho/conversão sobre todos os vendedores quando não há vendorId", () => {
    const result = dashboardKpis(deals);
    expect(result).toEqual({
      openCount: 1,
      wonCount: 4, // d1, d2, d5, d6
      lostCount: 1,
      openValue: 150,
      wonValue: 1000, // 300+200+400+100
      conversion: 80, // 4 ganhos / (4 ganhos + 1 perdido) * 100
    });
  });

  // Espelha dashboard.tsx:100-104 (barra de meta por vendedor)
  function dashboardGoalTotal(scopedDeals: Deal[], ownerId: string) {
    return scopedDeals
      .filter((d) => d.status === "ganho")
      .filter((d) => d.owner_id === ownerId)
      .reduce((s, d) => s + Number(d.value), 0);
  }

  it("soma o total ganho por vendedor para a barra de meta, sem filtro de período", () => {
    expect(dashboardGoalTotal(deals, "seller-a")).toBe(500);
    expect(dashboardGoalTotal(deals, "seller-b")).toBe(500);
  });
});

describe("relatorios.tsx — fórmulas atuais (réplica fiel, pré-refactor)", () => {
  // Espelha relatorios.tsx:62-77 (byLead)
  function byLeadRow(scopedDeals: Deal[], type: string) {
    const all = scopedDeals.filter((d) => d.lead_type === type);
    const won = all.filter((d) => d.status === "ganho");
    const lost = all.filter((d) => d.status === "perdido");
    const closed = won.length + lost.length;
    return {
      total: all.length,
      won: won.length,
      lost: lost.length,
      wonValue: won.reduce((s, d) => s + Number(d.value), 0),
      ticket: won.length > 0 ? won.reduce((s, d) => s + Number(d.value), 0) / won.length : 0,
      conversion: closed > 0 ? (won.length / closed) * 100 : 0,
    };
  }

  it("agrupa por tipo de lead com ticket médio e conversão", () => {
    const todosIndicacao = [
      ...deals,
      deal({ id: "d7", owner_id: "seller-a", status: "ganho", value: 300, lead_type: "Indicação" }),
    ].map((d) => ({ ...d, lead_type: "Indicação" }));
    const row = byLeadRow(todosIndicacao, "Indicação");
    expect(row.won).toBe(5); // d1, d2, d5, d6, d7
    expect(row.wonValue).toBe(1300);
    expect(row.ticket).toBe(260); // 1300 / 5
  });

  it("ticket médio é 0 quando não há negócio ganho naquele tipo de lead", () => {
    const row = byLeadRow(
      deals.filter((d) => d.status !== "ganho"),
      "Indicação",
    );
    expect(row.ticket).toBe(0);
    expect(row.conversion).toBe(0);
  });

  // Espelha relatorios.tsx:181-196 (tabela por vendedor)
  function sellerRow(scopedDeals: Deal[], ownerId: string) {
    const mine = scopedDeals.filter((d) => d.owner_id === ownerId);
    const won = mine.filter((d) => d.status === "ganho");
    const lost = mine.filter((d) => d.status === "perdido");
    const closed = won.length + lost.length;
    return {
      open: mine.filter((d) => d.status === "aberto").length,
      won: won.length,
      conversionLabel: closed > 0 ? `${((won.length / closed) * 100).toFixed(1)}%` : "—",
      wonValue: won.reduce((s, d) => s + Number(d.value), 0),
    };
  }

  it("mostra travessão quando o vendedor não tem negócios fechados no período", () => {
    const row = sellerRow(deals, "seller-sem-fechamento".concat(""));
    expect(row).toEqual({ open: 0, won: 0, conversionLabel: "—", wonValue: 0 });
  });

  it("calcula conversão por vendedor com um negócio aberto e um ganho", () => {
    const row = sellerRow(deals, "seller-a");
    expect(row).toEqual({ open: 1, won: 2, conversionLabel: "66.7%", wonValue: 500 });
  });
});

describe("comissoes.tsx — fórmula atual do card 'Receita ganha' (réplica fiel, pré-refactor)", () => {
  // Espelha comissoes.tsx:73 — soma TODOS os vendedores, sem filtro de vendorId/período.
  function receitaGanhaCard(scopedDeals: Deal[]) {
    return scopedDeals.filter((d) => d.status === "ganho").reduce((s, d) => s + Number(d.value), 0);
  }

  it("soma a receita ganha de todos os vendedores somados", () => {
    expect(receitaGanhaCard(deals)).toBe(1000); // 300+200+400+100, ignora dono
  });
});

describe("filterByPeriod() — comportamento atual (caracterização)", () => {
  it("usa closed_at quando presente, e cai para created_at quando closed_at é null", () => {
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));

    const comClosedAtAntigo = deal({
      id: "d1",
      owner_id: "seller-a",
      closed_at: "2020-01-01T00:00:00.000Z",
      created_at: "2026-10-15T12:00:00.000Z", // dentro da semana, mas closed_at manda
    });
    const semClosedAt = deal({
      id: "d2",
      owner_id: "seller-a",
      closed_at: null,
      created_at: "2026-10-15T12:00:00.000Z", // cai no fallback, dentro da semana
    });

    const result = filterByPeriod([comClosedAtAntigo, semClosedAt], "semana");
    expect(result.map((d) => d.id)).toEqual(["d2"]);

    vi.useRealTimers();
  });

  it("'semana' não tem limite superior — negócio no futuro ainda é incluído", () => {
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));

    const futuro = deal({
      id: "d-futuro",
      owner_id: "seller-a",
      closed_at: "2030-01-01T00:00:00.000Z",
    });
    expect(filterByPeriod([futuro], "semana").map((d) => d.id)).toEqual(["d-futuro"]);

    vi.useRealTimers();
  });

  it("'mes' exige mesmo ano e mesmo mês do relógio atual", () => {
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));

    // Horário em UTC-meio-dia para não cruzar a virada de dia/mês/ano por
    // causa do fuso horário local da máquina que roda o teste.
    const mesmoMes = deal({
      id: "d1",
      owner_id: "seller-a",
      closed_at: "2026-10-10T12:00:00.000Z",
    });
    const mesPassado = deal({
      id: "d2",
      owner_id: "seller-a",
      closed_at: "2026-09-15T12:00:00.000Z",
    });
    const anoPassadoMesmoMes = deal({
      id: "d3",
      owner_id: "seller-a",
      closed_at: "2025-10-15T12:00:00.000Z",
    });

    expect(
      filterByPeriod([mesmoMes, mesPassado, anoPassadoMesmoMes], "mes").map((d) => d.id),
    ).toEqual(["d1"]);

    vi.useRealTimers();
  });

  it("'ano' exige mesmo ano do relógio atual, qualquer mês", () => {
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));

    const mesmoAno = deal({
      id: "d1",
      owner_id: "seller-a",
      closed_at: "2026-06-15T12:00:00.000Z",
    });
    const anoPassado = deal({
      id: "d2",
      owner_id: "seller-a",
      closed_at: "2025-06-15T12:00:00.000Z",
    });

    expect(filterByPeriod([mesmoAno, anoPassado], "ano").map((d) => d.id)).toEqual(["d1"]);

    vi.useRealTimers();
  });

  it("array vazio retorna array vazio para qualquer período", () => {
    expect(filterByPeriod([], "mes")).toEqual([]);
  });
});

function contact(partial: Partial<Contact> & { id: string; name: string }): Contact {
  return {
    type: "cliente",
    owner_id: "seller-a",
    company: null,
    email: null,
    phone: null,
    notes: null,
    lead_type: null,
    source: null,
    churned_at: null,
    churn_reason: null,
    document: null,
    segment: null,
    specialty: null,
    is_active: true,
    legacy_form_submission_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("isActiveClient() — cliente ativo = tem negócio ganho e não cancelou", () => {
  it("true quando tem negócio ganho e não cancelou", () => {
    const c = contact({ id: "c1", name: "Cliente 1" });
    const won = [deal({ id: "d1", owner_id: "seller-a", client_id: "c1", status: "ganho" })];
    expect(isActiveClient(c, won)).toBe(true);
  });

  it("false quando não tem nenhum negócio ganho", () => {
    const c = contact({ id: "c1", name: "Cliente 1" });
    const aberto = [deal({ id: "d1", owner_id: "seller-a", client_id: "c1", status: "aberto" })];
    expect(isActiveClient(c, aberto)).toBe(false);
  });

  it("false quando já cancelou, mesmo tendo negócio ganho", () => {
    const c = contact({ id: "c1", name: "Cliente 1", churned_at: "2026-05-01T00:00:00.000Z" });
    const won = [deal({ id: "d1", owner_id: "seller-a", client_id: "c1", status: "ganho" })];
    expect(isActiveClient(c, won)).toBe(false);
  });

  it("false pra contato do tipo parceiro, mesmo com negócio ganho vinculado", () => {
    const c = contact({ id: "c1", name: "Parceiro 1", type: "parceiro" });
    const won = [deal({ id: "d1", owner_id: "seller-a", client_id: "c1", status: "ganho" })];
    expect(isActiveClient(c, won)).toBe(false);
  });
});

describe("churnFor() — taxa de churn do período", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z")); // dentro de outubro/2026
  });
  afterEach(() => vi.useRealTimers());

  it("conta no denominador quem ativou antes do período e não cancelou", () => {
    const ativoAntigo = contact({ id: "c1", name: "Cliente ativo" });
    const deals = [
      deal({
        id: "d1",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        value: 1000,
        closed_at: "2026-01-10T00:00:00.000Z", // antes do início do mês atual
      }),
    ];
    const result = churnFor([ativoAntigo], deals, "mes");
    expect(result.activeAtStart).toBe(1);
    expect(result.churned).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("conta como cancelado quem ativou antes e cancelou dentro do período", () => {
    const cancelado = contact({
      id: "c1",
      name: "Cliente cancelado",
      company: "Empresa X",
      churned_at: "2026-10-10T00:00:00.000Z", // dentro de outubro
      churn_reason: "Insatisfeito com preço",
    });
    const deals = [
      deal({
        id: "d1",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        value: 2000,
        closed_at: "2026-01-10T00:00:00.000Z",
      }),
    ];
    const result = churnFor([cancelado], deals, "mes");
    expect(result.activeAtStart).toBe(1);
    expect(result.churned).toBe(1);
    expect(result.rate).toBe(100);
    expect(result.churnedClients).toEqual([
      {
        id: "c1",
        name: "Cliente cancelado",
        company: "Empresa X",
        churned_at: "2026-10-10T00:00:00.000Z",
        churn_reason: "Insatisfeito com preço",
        wonValue: 2000,
      },
    ]);
  });

  it("não conta quem só ativou durante o próprio período", () => {
    const novo = contact({ id: "c1", name: "Cliente novo" });
    const deals = [
      deal({
        id: "d1",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        closed_at: "2026-10-05T00:00:00.000Z", // dentro do mês atual, não antes
      }),
    ];
    const result = churnFor([novo], deals, "mes");
    expect(result.activeAtStart).toBe(0);
    expect(result.churned).toBe(0);
  });

  it("não conta quem já tinha cancelado antes do início do período", () => {
    const canceladoAntigo = contact({
      id: "c1",
      name: "Cliente cancelado antigo",
      churned_at: "2026-02-01T00:00:00.000Z", // antes do início do mês atual
    });
    const deals = [
      deal({
        id: "d1",
        owner_id: "seller-a",
        client_id: "c1",
        status: "ganho",
        closed_at: "2026-01-10T00:00:00.000Z",
      }),
    ];
    const result = churnFor([canceladoAntigo], deals, "mes");
    expect(result.activeAtStart).toBe(0);
    expect(result.churned).toBe(0);
    expect(result.churnedClients).toEqual([]);
  });

  it("rate é 0 quando não há nenhum cliente ativo no início do período", () => {
    expect(churnFor([], [], "mes")).toEqual({
      activeAtStart: 0,
      churned: 0,
      rate: 0,
      churnedClients: [],
    });
  });

  it("ignora contatos do tipo parceiro", () => {
    const parceiro = contact({ id: "p1", name: "Parceiro", type: "parceiro" });
    const result = churnFor([parceiro], [], "mes");
    expect(result.activeAtStart).toBe(0);
  });
});
