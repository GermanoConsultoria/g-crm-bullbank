-- roles
CREATE TYPE public.app_role AS ENUM ('admin','vendedor');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  commission_rate NUMERIC NOT NULL DEFAULT 5,
  monthly_goal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_select_all" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  lead_type TEXT NOT NULL DEFAULT 'Indicação',
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select_all" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert_own" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));

-- stages
CREATE TABLE public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stages TO authenticated;
GRANT ALL ON public.stages TO service_role;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages_select_all" ON public.stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "stages_write" ON public.stages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stages_update" ON public.stages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "stages_delete" ON public.stages FOR DELETE TO authenticated USING (true);

INSERT INTO public.stages (name, position, color) VALUES
  ('Novo lead', 1, 'blue'),
  ('Contato feito', 2, 'blue'),
  ('Proposta enviada', 3, 'blue'),
  ('Negociação', 4, 'blue'),
  ('Fechamento', 5, 'blue');

-- deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients ON DELETE SET NULL,
  stage_id UUID REFERENCES public.stages ON DELETE SET NULL,
  title TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  lead_type TEXT NOT NULL DEFAULT 'Indicação',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_select_all" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "deals_insert_own" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));

-- tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'media',
  done BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_all" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'));

-- profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'vendedor'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();