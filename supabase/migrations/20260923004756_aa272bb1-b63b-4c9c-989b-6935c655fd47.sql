ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS agent_key TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.relay_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  req_headers JSONB NOT NULL DEFAULT '{}',
  body_b64 TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.relay_requests TO service_role;
ALTER TABLE public.relay_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.relay_responses (
  request_id UUID NOT NULL PRIMARY KEY REFERENCES public.relay_requests(id) ON DELETE CASCADE,
  status INT NOT NULL,
  res_headers JSONB NOT NULL DEFAULT '{}',
  body_b64 TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.relay_responses TO service_role;
ALTER TABLE public.relay_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS relay_requests_code_created ON public.relay_requests (session_code, created_at);