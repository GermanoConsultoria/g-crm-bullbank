-- Suporte a gerenciamento de contas pelo admin: ativar/desativar e forçar troca de senha no primeiro login.
ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN force_password_change BOOLEAN NOT NULL DEFAULT false;
