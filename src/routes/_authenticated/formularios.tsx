import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchFormSubmissions, shortDate, type FormSubmission } from "@/lib/crm";
import { FORM_TEMPLATES, type FormSubmissionType } from "@/lib/form-templates";

type FormulariosSearch = { vendorId?: string | undefined };

export const Route = createFileRoute("/_authenticated/formularios")({
  head: () => ({
    meta: [
      { title: "Formulários" },
      { name: "description", content: "Registros dos formulários de parceiros e clientes preenchidos pela equipe." },
      { property: "og:title", content: "Formulários" },
      { property: "og:description", content: "Registros dos formulários de parceiros e clientes preenchidos pela equipe." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): FormulariosSearch => ({
    vendorId: typeof search["vendorId"] === "string" ? (search["vendorId"] as string) : undefined,
  }),
  component: FormulariosPage,
});

const EMPTY_FORM: Record<string, string> = {};

function FormulariosPage() {
  const { vendorId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: allSubmissions = [] } = useQuery({ queryKey: ["form-submissions"], queryFn: fetchFormSubmissions });
  const submissions = vendorId ? allSubmissions.filter((s) => s.owner_id === vendorId) : allSubmissions;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormSubmission | null>(null);
  const [type, setType] = useState<FormSubmissionType>("cliente");
  const [formData, setFormData] = useState<Record<string, string>>(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState<FormSubmission | null>(null);

  const template = FORM_TEMPLATES[type];

  const resetForm = () => {
    setEditing(null);
    setType("cliente");
    setFormData(EMPTY_FORM);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        name: formData["nome"]?.trim() || "Sem nome",
        company: formData["empresa"]?.trim() || null,
        data: formData,
      };
      if (editing) {
        const { error } = await supabase.from("form_submissions").update(payload).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("form_submissions")
        .insert({ ...payload, owner_id: vendorId ?? userData.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions"] });
      toast.success(editing ? "Registro atualizado." : "Registro criado.");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("form_submissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions"] });
      toast.success("Registro removido.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (submission: FormSubmission) => {
    setEditing(submission);
    setType(submission.type);
    setFormData(submission.data ?? {});
    setOpen(true);
  };

  const setField = (key: string, value: string) => setFormData((p) => ({ ...p, [key]: value }));

  return (
    <AppShell
      title="Formulários"
      subtitle={`${submissions.length} registro${submissions.length === 1 ? "" : "s"}`}
      actions={
        <>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" /> Novo registro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar registro" : "Novo registro"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo de formulário</Label>
                  <select
                    value={type}
                    disabled={!!editing}
                    onChange={(e) => setType(e.target.value as FormSubmissionType)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                  >
                    {Object.entries(FORM_TEMPLATES).map(([value, tpl]) => (
                      <option key={value} value={value}>
                        {tpl.label}
                      </option>
                    ))}
                  </select>
                </div>

                {template.sections.map((section, idx) => (
                  <div key={section.title ?? idx} className="space-y-3 border-t border-border pt-3 first:border-0 first:pt-0">
                    {section.title && <p className="text-sm font-medium">{section.title}</p>}
                    <div className="grid gap-3">
                      {section.fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label>{field.label}</Label>
                          {field.type === "input" ? (
                            <Input
                              value={formData[field.key] ?? ""}
                              onChange={(e) => setField(field.key, e.target.value)}
                            />
                          ) : (
                            <Textarea
                              className="min-h-[70px]"
                              value={formData[field.key] ?? ""}
                              onChange={(e) => setField(field.key, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!pendingDelete} onOpenChange={(next) => !next && setPendingDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir registro</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o registro de "{pendingDelete?.name}"? Essa ação não pode ser
                  desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                  onClick={() => {
                    if (pendingDelete) remove.mutate(pendingDelete.id);
                    setPendingDelete(null);
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    >
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {submissions.map((submission) => (
              <tr key={submission.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <Badge variant="secondary">{FORM_TEMPLATES[submission.type]?.label ?? submission.type}</Badge>
                </td>
                <td className="px-4 py-3 font-medium">{submission.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{submission.company ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{shortDate(submission.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(submission)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setPendingDelete(submission)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList className="size-8 text-muted-foreground" />
                    Nenhum formulário registrado ainda.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
