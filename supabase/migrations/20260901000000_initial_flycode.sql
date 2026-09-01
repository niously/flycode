-- Flycode database baseline for Supabase.
-- This creates the relational schema only; it does not import production data.
-- The GitHub integration applies this file to the configured Supabase project.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.flycode_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  current_phase_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.phases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitting', 'voting', 'execution', 'archived')),
  deadline DATE,
  chosen_proposal_id TEXT,
  decision_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.proposals (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (phase_id, id)
);

CREATE TABLE IF NOT EXISTS public.phase_candidates (
  phase_id TEXT NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (phase_id, proposal_id)
);

CREATE TABLE IF NOT EXISTS public.votes (
  phase_id TEXT NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (phase_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS public.decisions (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES public.proposals(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.updates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS phases_project_number_idx
  ON public.phases (project_id, number);
CREATE INDEX IF NOT EXISTS proposals_phase_status_created_idx
  ON public.proposals (phase_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS votes_proposal_idx
  ON public.votes (proposal_id);
CREATE INDEX IF NOT EXISTS updates_project_created_idx
  ON public.updates (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_project_created_idx
  ON public.audit_logs (project_id, created_at DESC);

INSERT INTO public.schema_migrations (version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;

-- Keep all app tables inaccessible through the public client by default.
-- Server-side migrations and the Flycode backend use the service role.
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flycode_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
