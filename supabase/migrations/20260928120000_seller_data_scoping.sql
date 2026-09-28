-- Isola os dados de cada vendedor: cada um só vê e mexe no que é seu
-- (clients, deals, tasks, form_submissions, profiles, user_roles).
-- Admin continua enxergando tudo (public.has_role(auth.uid(),'admin')).
-- Gestão de usuários (profiles/user_roles) continua exclusiva do administrador
-- via UI; o cadastro de clientes é próprio de cada vendedor, como deals/tasks.

-- profiles: antes "select_all"; agora só o próprio perfil ou admin.
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- user_roles: antes "select_all"; agora só o próprio papel ou admin.
DROP POLICY IF EXISTS "roles_select_all" ON public.user_roles;
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- clients: cada vendedor cadastra e vê só os próprios contatos; admin vê todos.
DROP POLICY IF EXISTS "clients_select_all" ON public.clients;
CREATE POLICY "clients_select_own_or_admin" ON public.clients
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "clients_insert_own" ON public.clients;
CREATE POLICY "clients_insert_own_or_admin" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update_own_or_admin" ON public.clients
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "clients_delete" ON public.clients;
CREATE POLICY "clients_delete_own_or_admin" ON public.clients
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- deals: cada vendedor só vê/mexe nos próprios negócios; admin vê todos.
DROP POLICY IF EXISTS "deals_select_all" ON public.deals;
CREATE POLICY "deals_select_own_or_admin" ON public.deals
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "deals_insert_own" ON public.deals;
CREATE POLICY "deals_insert_own_or_admin" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- tasks: mesma lógica de deals.
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
CREATE POLICY "tasks_select_own_or_admin" ON public.tasks
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
CREATE POLICY "tasks_insert_own_or_admin" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- form_submissions: mesma lógica de deals/tasks.
DROP POLICY IF EXISTS "form_submissions_select_all" ON public.form_submissions;
CREATE POLICY "form_submissions_select_own_or_admin" ON public.form_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "form_submissions_insert" ON public.form_submissions;
CREATE POLICY "form_submissions_insert_own_or_admin" ON public.form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "form_submissions_update" ON public.form_submissions;
CREATE POLICY "form_submissions_update_own_or_admin" ON public.form_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "form_submissions_delete" ON public.form_submissions;
CREATE POLICY "form_submissions_delete_own_or_admin" ON public.form_submissions
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
