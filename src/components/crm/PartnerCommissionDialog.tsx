import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currency, monthKeyOf, monthLabel, partnerMonthlyReports, type Contact, type Deal } from "@/lib/crm";

type PartnerCommissionDialogProps = {
  partner: Contact | null;
  deals: Deal[];
  contacts: Contact[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Formata "YYYY-MM-DD" direto por string, sem passar por new Date()/Intl —
// paymentDate é só uma data (sem hora), e formatar via Date()+timezone local
// deslocaria o dia em fusos negativos.
const formatPaymentDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function PartnerCommissionDialog({
  partner,
  deals,
  contacts,
  open,
  onOpenChange,
}: PartnerCommissionDialogProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);

  const reports = partner ? partnerMonthlyReports(deals, contacts, partner.id) : [];
  const now = new Date();
  const currentMonth = monthKeyOf(now.toISOString());
  const months = reports.some((r) => r.month === currentMonth)
    ? reports
    : [
        ...reports,
        {
          month: currentMonth,
          label: monthLabel(now.getFullYear(), now.getMonth()),
          rows: [],
          totalValue: 0,
          totalCommission: 0,
        },
      ].sort((a, b) => a.month.localeCompare(b.month));

  const activeMonth =
    (selectedMonth && months.some((m) => m.month === selectedMonth) ? selectedMonth : null) ?? currentMonth;
  const activeReport = months.find((m) => m.month === activeMonth);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Comissões do parceiro{partner ? ` — ${partner.name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Valor arrecadado <span className="text-muted-foreground/70">· {activeReport?.label ?? "—"}</span>
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{currency(activeReport?.totalValue ?? 0)}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Comissão do parceiro <span className="text-muted-foreground/70">· {activeReport?.label ?? "—"}</span>
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {currency(activeReport?.totalCommission ?? 0)}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Clientes indicados no mês</p>
          <Select value={activeMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Mês..." />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.month} value={m.month}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="panel mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Parceiro</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Valor arrecadado</th>
                <th className="px-4 py-2 font-medium">Taxa</th>
                <th className="px-4 py-2 font-medium">Comissão</th>
                <th className="px-4 py-2 font-medium">Pagamento em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(activeReport?.rows ?? []).map((row) => (
                <tr key={row.clientId}>
                  <td className="px-4 py-2">{row.partnerName}</td>
                  <td className="px-4 py-2">{row.clientName}</td>
                  <td className="px-4 py-2">{currency(row.value)}</td>
                  <td className="px-4 py-2">{row.commissionRate.toFixed(1)}%</td>
                  <td className="px-4 py-2 font-medium text-primary">{currency(row.commission)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatPaymentDate(row.paymentDate)}</td>
                </tr>
              ))}
              {(!activeReport || activeReport.rows.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum negócio ganho indicado neste mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
