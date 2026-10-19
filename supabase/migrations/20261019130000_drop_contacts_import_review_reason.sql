-- Remove o status "pendente de revisão" de parceiros. O campo nunca era
-- limpo pela UI (ficava marcado para sempre, mesmo depois do admin revisar
-- e ativar o cadastro), então deixou de fazer sentido como status.
ALTER TABLE public.contacts DROP COLUMN import_review_reason;
