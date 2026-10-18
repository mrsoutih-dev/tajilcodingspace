/*
# Core schema for ZohoDigital AI Studio

Creates the foundational tables for the platform: user profiles, projects,
AI chat conversations and messages, agent sessions, OmniRoute provider
configuration, deployment targets and records, the skills registry and
per-project installations, GitHub connections, and in-app notifications.

## New Tables
- `profiles` — per-user display data (full name, preferred language, role).
- `projects` — user-owned projects with name, description, status, language.
- `conversations` — chat sessions (standalone or project-scoped).
- `messages` — individual messages inside a conversation.
- `agent_sessions` — multi-agent orchestration session definitions.
- `agent_roles` — roles assigned within an agent session.
- `omniroute_config` — per-user OmniRoute provider settings (one row each).
- `deploy_targets` — Coolify deployment target configurations per project.
- `deploy_records` — history of deployment executions.
- `skill_registry` — central catalog of approved skills/MCP servers/tools.
- `skill_installations` — per-project skill install/enable state.
- `github_connections` — per-user GitHub OAuth connection metadata.
- `notifications` — in-app notifications for the user.

## Security
- RLS enabled on every table.
- All tables are owner-scoped to the authenticated user via `user_id`
  (or scoped through a parent table for children like messages, agent_roles,
  deploy_records, skill_installations).
- Owner columns default to `auth.uid()` so client inserts that omit `user_id`
  still satisfy the INSERT WITH CHECK.
- Four separate policies (SELECT/INSERT/UPDATE/DELETE) per table, scoped
  `TO authenticated`.
- `skill_registry` is intentionally shared/readable by all authenticated
  users (catalog data), but only admins can write — here we allow
  authenticated SELECT and no direct INSERT/UPDATE/DELETE from the client
  (managed via service role / migrations) for safety.

## Important notes
1. Foreign keys use `ON DELETE CASCADE` where appropriate so deleting a
   project cleanly removes its conversations, agent sessions, deploy
   targets, and skill installations.
2. Timestamps default to `now()`.
3. All `user_id` columns are `NOT NULL DEFAULT auth.uid()`.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  preferred_language text NOT NULL DEFAULT 'en',
  role text NOT NULL DEFAULT 'user',
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- projects ----------
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'en',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at DESC);

-- ---------- conversations ----------
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New chat',
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  model text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON conversations;
CREATE POLICY "select_own_conversations" ON conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON conversations;
CREATE POLICY "insert_own_conversations" ON conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_conversations" ON conversations;
CREATE POLICY "update_own_conversations" ON conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON conversations;
CREATE POLICY "delete_own_conversations" ON conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_project_id_idx ON conversations(project_id);

-- ---------- messages ----------
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

-- ---------- agent_sessions ----------
CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Agent session',
  prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'idle',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agent_sessions" ON agent_sessions;
CREATE POLICY "select_own_agent_sessions" ON agent_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_agent_sessions" ON agent_sessions;
CREATE POLICY "insert_own_agent_sessions" ON agent_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_agent_sessions" ON agent_sessions;
CREATE POLICY "update_own_agent_sessions" ON agent_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_agent_sessions" ON agent_sessions;
CREATE POLICY "delete_own_agent_sessions" ON agent_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS agent_sessions_user_id_idx ON agent_sessions(user_id);

-- ---------- agent_roles ----------
CREATE TABLE IF NOT EXISTS agent_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'idle',
  output text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agent_roles" ON agent_roles;
CREATE POLICY "select_own_agent_roles" ON agent_roles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_roles.session_id AND agent_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_agent_roles" ON agent_roles;
CREATE POLICY "insert_own_agent_roles" ON agent_roles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_roles.session_id AND agent_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_agent_roles" ON agent_roles;
CREATE POLICY "update_own_agent_roles" ON agent_roles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_roles.session_id AND agent_sessions.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_roles.session_id AND agent_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_agent_roles" ON agent_roles;
CREATE POLICY "delete_own_agent_roles" ON agent_roles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_roles.session_id AND agent_sessions.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS agent_roles_session_id_idx ON agent_roles(session_id);

-- ---------- omniroute_config ----------
CREATE TABLE IF NOT EXISTS omniroute_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url text NOT NULL DEFAULT '',
  default_model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE omniroute_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_omniroute_config" ON omniroute_config;
CREATE POLICY "select_own_omniroute_config" ON omniroute_config FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_omniroute_config" ON omniroute_config;
CREATE POLICY "insert_own_omniroute_config" ON omniroute_config FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_omniroute_config" ON omniroute_config;
CREATE POLICY "update_own_omniroute_config" ON omniroute_config FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_omniroute_config" ON omniroute_config;
CREATE POLICY "delete_own_omniroute_config" ON omniroute_config FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- deploy_targets ----------
CREATE TABLE IF NOT EXISTS deploy_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Production',
  environment text NOT NULL DEFAULT 'production',
  coolify_server_url text NOT NULL DEFAULT '',
  coolify_project text NOT NULL DEFAULT '',
  coolify_service text NOT NULL DEFAULT '',
  env_vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deploy_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_deploy_targets" ON deploy_targets;
CREATE POLICY "select_own_deploy_targets" ON deploy_targets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deploy_targets" ON deploy_targets;
CREATE POLICY "insert_own_deploy_targets" ON deploy_targets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_deploy_targets" ON deploy_targets;
CREATE POLICY "update_own_deploy_targets" ON deploy_targets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_deploy_targets" ON deploy_targets;
CREATE POLICY "delete_own_deploy_targets" ON deploy_targets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS deploy_targets_project_id_idx ON deploy_targets(project_id);

-- ---------- deploy_records ----------
CREATE TABLE IF NOT EXISTS deploy_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES deploy_targets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  log text NOT NULL DEFAULT '',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deploy_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_deploy_records" ON deploy_records;
CREATE POLICY "select_own_deploy_records" ON deploy_records FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM deploy_targets WHERE deploy_targets.id = deploy_records.target_id AND deploy_targets.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_deploy_records" ON deploy_records;
CREATE POLICY "insert_own_deploy_records" ON deploy_records FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM deploy_targets WHERE deploy_targets.id = deploy_records.target_id AND deploy_targets.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_deploy_records" ON deploy_records;
CREATE POLICY "update_own_deploy_records" ON deploy_records FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM deploy_targets WHERE deploy_targets.id = deploy_records.target_id AND deploy_targets.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM deploy_targets WHERE deploy_targets.id = deploy_records.target_id AND deploy_targets.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS deploy_records_target_id_idx ON deploy_records(target_id);
CREATE INDEX IF NOT EXISTS deploy_records_created_at_idx ON deploy_records(created_at DESC);

-- ---------- skill_registry ----------
-- Shared catalog of approved skills (readable by all authenticated users;
-- writes managed via service role / migrations, not client).
CREATE TABLE IF NOT EXISTS skill_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  author text NOT NULL DEFAULT '',
  approval_required boolean NOT NULL DEFAULT false,
  icon text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE skill_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_skill_registry" ON skill_registry;
CREATE POLICY "read_skill_registry" ON skill_registry FOR SELECT
  TO authenticated USING (true);

-- ---------- skill_installations ----------
CREATE TABLE IF NOT EXISTS skill_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skill_registry(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  approved boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE skill_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_skill_installations" ON skill_installations;
CREATE POLICY "select_own_skill_installations" ON skill_installations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_skill_installations" ON skill_installations;
CREATE POLICY "insert_own_skill_installations" ON skill_installations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_skill_installations" ON skill_installations;
CREATE POLICY "update_own_skill_installations" ON skill_installations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_skill_installations" ON skill_installations;
CREATE POLICY "delete_own_skill_installations" ON skill_installations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS skill_installations_project_id_idx ON skill_installations(project_id);

-- ---------- github_connections ----------
CREATE TABLE IF NOT EXISTS github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username text NOT NULL DEFAULT '',
  connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_github_connection" ON github_connections;
CREATE POLICY "select_own_github_connection" ON github_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_github_connection" ON github_connections;
CREATE POLICY "insert_own_github_connection" ON github_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_github_connection" ON github_connections;
CREATE POLICY "update_own_github_connection" ON github_connections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_github_connection" ON github_connections;
CREATE POLICY "delete_own_github_connection" ON github_connections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- ---------- updated_at trigger helper ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_touch_updated_at ON projects;
CREATE TRIGGER projects_touch_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS conversations_touch_updated_at ON conversations;
CREATE TRIGGER conversations_touch_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS agent_sessions_touch_updated_at ON agent_sessions;
CREATE TRIGGER agent_sessions_touch_updated_at BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS omniroute_config_touch_updated_at ON omniroute_config;
CREATE TRIGGER omniroute_config_touch_updated_at BEFORE UPDATE ON omniroute_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS deploy_targets_touch_updated_at ON deploy_targets;
CREATE TRIGGER deploy_targets_touch_updated_at BEFORE UPDATE ON deploy_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS github_connections_touch_updated_at ON github_connections;
CREATE TRIGGER github_connections_touch_updated_at BEFORE UPDATE ON github_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- seed skill_registry (approved skills catalog) ----------
INSERT INTO skill_registry (slug, name, description, category, author, approval_required, icon)
VALUES
  ('context7', 'Context7 MCP', 'Up-to-date documentation lookup for libraries and frameworks via MCP.', 'mcp', 'Context7', false, 'book'),
  ('filesystem', 'Filesystem MCP', 'Read/write access to project files for AI agents.', 'mcp', 'Anthropic', true, 'folder'),
  ('github-mcp', 'GitHub MCP', 'Manage repositories, branches, issues, and pull requests.', 'mcp', 'GitHub', true, 'git-branch'),
  ('sequential-thinking', 'Sequential Thinking', 'Step-by-step reasoning agent framework for complex tasks.', 'agent', 'Anthropic', false, 'brain'),
  ('claude-code', 'Claude Code CLI', 'Terminal-based AI coding agent for local development.', 'cli', 'Anthropic', true, 'terminal'),
  ('aider', 'Aider CLI', 'AI pair programming in the terminal with git integration.', 'cli', 'Aider', true, 'terminal'),
  ('playwright-mcp', 'Playwright MCP', 'Browser automation and testing via MCP.', 'mcp', 'Microsoft', true, 'globe'),
  ('figma-mcp', 'Figma MCP', 'Import designs from Figma into your projects.', 'mcp', 'Figma', false, 'figma'),
  ('postgres-mcp', 'Postgres MCP', 'Query and manage Postgres databases from agents.', 'mcp', 'Supabase', true, 'database'),
  ('sentry-mcp', 'Sentry MCP', 'Pull error reports and stack traces from Sentry.', 'mcp', 'Sentry', false, 'shield-alert')
ON CONFLICT (slug) DO NOTHING;
