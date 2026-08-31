
-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

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
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- new user -> profile; first ever user becomes the founder/admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- MARKETPLACE ---------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  tagline text,
  description text,
  category text NOT NULL DEFAULT 'template',
  tech text[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL DEFAULT 4900,
  status text NOT NULL DEFAULT 'draft',
  cover_url text,
  demo_url text,
  asset_path text,
  seo_title text,
  seo_description text,
  tags text[] NOT NULL DEFAULT '{}',
  quality_score integer,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published products are public" ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'published');
CREATE POLICY "admins read all products" ON public.products FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "admins write products" ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'manual',
  provider_ref text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "create own orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  download_count integer NOT NULL DEFAULT 0,
  last_download_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases" ON public.purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.download_events TO authenticated;
GRANT ALL ON public.download_events TO service_role;
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin download events" ON public.download_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- AI OPERATING SYSTEM --------------------------------------------------
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'google/gemini-3.7-flash',
  schedule text,
  system_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  metric text,
  target text,
  priority integer NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text,
  tool_name text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  args_hash text NOT NULL,
  title text NOT NULL,
  reason text,
  evidence jsonb,
  risk_level text NOT NULL DEFAULT 'medium',
  confidence numeric,
  expected_outcome text,
  before_state jsonb,
  after_state jsonb,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  executed_at timestamptz,
  execution_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  agent_key text,
  priority integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'queued',
  requires_approval boolean NOT NULL DEFAULT false,
  approval_id uuid REFERENCES public.ai_approvals(id) ON DELETE SET NULL,
  dedupe_key text UNIQUE,
  result jsonb,
  error text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text,
  task_id uuid,
  approval_id uuid,
  action text NOT NULL,
  tool_name text,
  input_summary text,
  output_summary text,
  risk_level text,
  approval_required boolean NOT NULL DEFAULT false,
  result text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'operational',
  source text NOT NULL DEFAULT 'ai_recommendation',
  title text NOT NULL,
  content text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'policy',
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'low',
  title text NOT NULL,
  description text,
  source text,
  affected_system text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'daily',
  title text NOT NULL,
  body text NOT NULL,
  metrics jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event text NOT NULL,
  condition text,
  action text NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  requires_approval boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT false,
  max_runs_per_day integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_cost_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text,
  model text,
  request_count integer NOT NULL DEFAULT 1,
  estimated_cost_cents numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ai_enabled boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  emergency_stop boolean NOT NULL DEFAULT false,
  pause_reason text,
  daily_budget_cents integer NOT NULL DEFAULT 500,
  chat_model text NOT NULL DEFAULT 'openai/gpt-5.6-terra',
  fast_model text NOT NULL DEFAULT 'google/gemini-3.7-flash',
  auto_apply_low_risk_seo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_agents','ai_goals','ai_approvals','ai_tasks','ai_activity_logs','ai_memory',
                           'ai_knowledge_documents','ai_incidents','ai_reports','ai_automations','ai_events',
                           'ai_cost_usage','ai_settings']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "admin only" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

CREATE INDEX ON public.ai_activity_logs (created_at DESC);
CREATE INDEX ON public.ai_tasks (status, priority);
CREATE INDEX ON public.ai_approvals (status, created_at DESC);
CREATE INDEX ON public.orders (status, created_at DESC);
CREATE INDEX ON public.products (status);

INSERT INTO public.ai_settings (id) VALUES (true);

INSERT INTO public.ai_agents (key, name, description, schedule, system_instructions) VALUES
 ('CEO','AI CEO','Coordinates all agents, prioritises work and briefs the founder.','daily 09:00','Act as the CodeVault CEO. Use verified data only. Never invent metrics. Escalate anything financial or irreversible to the founder.'),
 ('OPERATIONS','Operations Agent','Monitors orders, payments, downloads and system health.','hourly','Detect operational anomalies, create tasks, attempt only safe deterministic remediation.'),
 ('SUPPORT','Support Agent','Drafts customer responses and triages tickets.',null,'Only use data belonging to the authenticated customer. Escalate refunds, disputes and security issues.'),
 ('PRODUCT','Product Agent','Analyses product performance and prepares listings.','every 6 hours','Prepare product drafts; never publish without approval.'),
 ('MARKETING','Marketing Agent','Prepares campaigns and promotional copy.','weekly','All outbound communication requires founder approval.'),
 ('SEO','SEO Agent','Audits and improves product metadata.','daily','Low-risk metadata drafts are allowed; public-facing changes need approval unless policy permits.'),
 ('ANALYTICS','Analytics Agent','Computes metrics, trends and comparisons.','daily','Report only figures returned by tools.'),
 ('QUALITY','Quality Control Agent','Scores products before publication.',null,'Produce a quality score with concrete findings.'),
 ('SECURITY_MONITOR','Security Monitor','Watches for abuse, fraud signals and permission violations.','hourly','Alert and create incidents. Never disable users or infrastructure autonomously.');

INSERT INTO public.ai_goals (title, metric, target, priority) VALUES
 ('Grow monthly revenue','revenue','+20% MoM',1),
 ('Eliminate failed downloads','failed_downloads','0 per week',1),
 ('Improve catalog quality','quality_score','avg > 90',2),
 ('Increase conversion','conversion','> 4%',2);

INSERT INTO public.ai_knowledge_documents (title, category, body) VALUES
 ('Refund policy','policy','Digital source code is refundable within 7 days if the product is materially broken and support cannot resolve it. Refunds are executed by the founder only.'),
 ('License policy','policy','Single commercial license per purchase. Redistribution or resale of source code is prohibited.'),
 ('Pricing philosophy','strategy','CodeVault is premium-positioned. Avoid discounts above 20%. Prefer bundles over price cuts.');

INSERT INTO public.products (slug,title,tagline,description,category,tech,price_cents,status,demo_url,seo_title,seo_description,tags,quality_score,views) VALUES
 ('react-saas-dashboard','React SaaS Dashboard','Production-ready SaaS admin with billing and teams','A complete React + Vite SaaS dashboard including auth, billing hooks, team management, role permissions and a themeable design system.','dashboard','{React,TypeScript,Tailwind}',7900,'published','https://example.com/demo/react-saas','React SaaS Dashboard Source Code','Buy a production-ready React SaaS dashboard with auth, billing and teams.','{saas,dashboard,react}',94,1820),
 ('nextjs-commerce-kit','Next.js Commerce Kit','Headless storefront with checkout and CMS','Next.js App Router storefront: product catalog, cart, checkout, order history, CMS-driven content and SEO-optimised pages.','e-commerce','{"Next.js",TypeScript,Stripe}',8900,'published','https://example.com/demo/next-commerce','Next.js Commerce Starter Kit','Launch a headless commerce storefront with Next.js in a weekend.','{ecommerce,nextjs}',91,1410),
 ('mern-marketplace','MERN Marketplace','Two-sided marketplace with payouts','MongoDB, Express, React and Node marketplace with vendor onboarding, listings, orders and payout ledger.','web-app','{MongoDB,Express,React,Node}',6900,'published','https://example.com/demo/mern','MERN Marketplace Source Code','Full MERN marketplace source code with vendors and payouts.','{mern,marketplace}',86,930),
 ('flutter-fitness-app','Flutter Fitness App','Cross-platform fitness tracker','Flutter app with workout plans, progress charts, offline storage and push notifications.','mobile','{Flutter,Dart}',5900,'published',null,null,null,'{flutter,mobile}',72,610),
 ('rn-delivery-app','React Native Delivery App','Courier and customer apps in one codebase','React Native delivery platform with live tracking, driver flow and order lifecycle.','mobile','{"React Native",Expo}',6400,'published','https://example.com/demo/rn-delivery','React Native Delivery App','Delivery app source code with tracking and driver flows.','{react-native,delivery}',88,540),
 ('ai-chat-starter','AI Chat Starter Kit','Streaming AI chat with tools and memory','Streaming AI chat starter with tool calling, conversation persistence, rate limiting and admin analytics.','ai','{React,TypeScript,"AI SDK"}',9900,'published','https://example.com/demo/ai-chat','AI Chat Starter Kit Source Code','Ship an AI product fast with a streaming chat starter kit.','{ai,chat}',96,2240),
 ('devtools-cli-suite','DevTools CLI Suite','Scaffolding and codegen CLI toolkit','A TypeScript CLI toolkit for scaffolding projects, generating code and automating releases.','developer-tools','{TypeScript,Node}',3900,'published',null,null,null,'{cli,devtools}',64,220),
 ('aurora-ui-kit','Aurora UI Kit','120+ accessible React components','Accessible, themeable React component library with dark mode, motion presets and Figma parity.','ui-kit','{React,Tailwind}',4900,'draft',null,null,null,'{ui,components}',58,0);
