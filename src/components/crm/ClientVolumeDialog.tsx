import { useState } from "react";
import {
  Legend,
  Line,
  LineChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientVolumeByDayFor, clientVolumeFor, currency, shortDate, type Contact, type Deal } from "@/lib/crm";

type ClientVolumeDialogProps = {
  contact: Contact | null;
  deals: Deal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Granularity = "mes" | "ano";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

export function ClientVolumeDialog({
  contact,
  deals,
  open,
  onOpenChange,
}: ClientVolumeDialogProps) {
  const [granularity, setGranularity] = useState<Granularity>("ano");
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);

  const volume = contact ? clientVolumeFor(deals, contact.id, contact.churned_at) : null;

  const availableMonths = volume?.months.map((m) => ({ key: m.month, label: m.label })) ?? [];
  const activeMonth =
    (selectedMonth && availableMonths.some((m) => m.key === selectedMonth) ? selectedMonth : null) ??
    availableMonths.at(-1)?.key;

  const dayData =
    granularity === "mes" && activeMonth
      ? clientVolumeByDayFor(
          deals,
          contact?.id ?? "",
          Number(activeMonth.slice(0, 4)),
          Number(activeMonth.slice(5, 7)),
          contact?.churned_at,
        )
      : [];

  const chartData = granularity === "ano" ? volume?.months ?? [] : dayData;
  const churnPoint = chartData.find((p) => p.churned);
  const activeMonthLabel = availableMonths.find((m) => m.key === activeMonth)?.label;

  // Os cards do topo acompanham o período em foco: no "Ano" mostram o
  // acumulado histórico (tudo); no "Mês" mostram só o mês selecionado.
  const activeMonthEntry = volume?.months.find((m) => m.month === activeMonth);
  const periodStats =
    granularity === "ano"
      ? { total: volume?.total ?? 0, wonCount: volume?.wonCount ?? 0 }
      : { total: activeMonthEntry?.value ?? 0, wonCount: activeMonthEntry?.count ?? 0 };
  const periodQualifier = granularity === "ano" ? "todo o período" : activeMonthLabel ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Volume de compras{contact ? ` — ${contact.name}` : ""}</DialogTitle>
        </DialogHeader>

        {volume && volume.wonCount > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total comprado <span className="text-muted-foreground/70">· {periodQualifier}</span>
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {currency(periodStats.total)}
                </p>
              </div>
              <div className="panel p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Negócios ganhos <span className="text-muted-foreground/70">· {periodQualifier}</span>
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{periodStats.wonCount}</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Evolução do total comprado</p>
                <div className="flex items-center gap-2">
                  {granularity === "mes" && activeMonth && (
                    <Select value={activeMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue placeholder="Mês..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMonths.map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                    {GRANULARITIES.map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setGranularity(g.value)}
                        className={`rounded px-2.5 py-1 text-xs transition-colors ${
                          granularity === g.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {granularity === "ano"
                  ? "Totais por mês."
                  : `Totais por dia em ${activeMonthLabel ?? "—"}.`}
              </p>
              {contact?.churned_at && (
                <p className="mt-1 text-xs text-destructive">
                  Cliente cancelou em {shortDate(contact.churned_at)}
                  {contact.churn_reason ? ` — ${contact.churn_reason}` : ""}
                </p>
              )}
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v: number) => currency(v)}
                      width={90}
                    />
                    <Tooltip
                      formatter={(v: number) => currency(v)}
                      labelFormatter={(label: string) =>
                        label === churnPoint?.label ? `${label} — cancelou` : label
                      }
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-popover-foreground)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {churnPoint && (
                      <ReferenceLine
                        x={churnPoint.label}
                        stroke="var(--color-destructive)"
                        strokeDasharray="4 4"
                        label={{
                          value: "Cancelou",
                          position: "insideTopRight",
                          fill: "var(--color-destructive)",
                          fontSize: 11,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name={granularity === "ano" ? "Total acumulado" : "Total acumulado no mês"}
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      dot={(props: { cx: number; cy: number; payload: { churned?: boolean }; index: number }) => {
                        const { cx, cy, payload, index } = props;
                        return payload.churned ? (
                          <circle
                            key={`dot-${index}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="var(--color-destructive)"
                            stroke="var(--color-destructive)"
                          />
                        ) : (
                          <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill="var(--color-chart-1)" />
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={granularity === "ano" ? "Total por compra (mês)" : "Total por compra (dia)"}
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <p className="panel p-6 text-center text-sm text-muted-foreground">
            Nenhuma compra registrada ainda.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
