CREATE TYPE public.app_role AS ENUM ('admin', 'guru');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  grade_level text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 20,
  published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_class text NOT NULL,
  device_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX attempts_quiz_device_idx ON public.attempts (quiz_id, device_id);
CREATE UNIQUE INDEX attempts_quiz_identity_idx ON public.attempts (quiz_id, lower(student_name), lower(student_class));
GRANT SELECT ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "user_roles_select_authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "quizzes_select" ON public.quizzes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());
CREATE POLICY "quizzes_insert" ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'guru')));
CREATE POLICY "quizzes_update" ON public.quizzes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());
CREATE POLICY "quizzes_delete" ON public.quizzes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

CREATE POLICY "questions_all" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = questions.quiz_id AND (public.has_role(auth.uid(), 'admin') OR q.created_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = questions.quiz_id AND (public.has_role(auth.uid(), 'admin') OR q.created_by = auth.uid())));

CREATE POLICY "attempts_select" ON public.attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = attempts.quiz_id AND (public.has_role(auth.uid(), 'admin') OR q.created_by = auth.uid())));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();