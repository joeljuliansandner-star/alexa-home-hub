CREATE TABLE public.ha_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url text NOT NULL,
  access_token text NOT NULL,
  ha_version text,
  location_name text,
  last_sync_at timestamptz,
  last_error text,
  entity_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ha_connections TO authenticated;
GRANT ALL ON public.ha_connections TO service_role;

ALTER TABLE public.ha_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ha connection" ON public.ha_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ha_connections_updated
  BEFORE UPDATE ON public.ha_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();