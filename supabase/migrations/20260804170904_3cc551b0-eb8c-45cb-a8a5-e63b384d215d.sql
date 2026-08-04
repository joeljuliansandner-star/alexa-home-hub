CREATE TABLE public.alexa_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  amazon_user_id text,
  account_name text,
  account_email text,
  access_token text NOT NULL,
  refresh_token text,
  token_type text NOT NULL DEFAULT 'bearer',
  scope text,
  expires_at timestamptz NOT NULL,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.alexa_connections TO service_role;
ALTER TABLE public.alexa_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages alexa connections" ON public.alexa_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER alexa_connections_updated BEFORE UPDATE ON public.alexa_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.alexa_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  serial_number text,
  name text NOT NULL,
  device_type text,
  device_family text,
  room text,
  is_online boolean NOT NULL DEFAULT false,
  firmware_version text,
  software_version text,
  wifi_status text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  unsupported_properties jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_source text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alexa_devices TO authenticated;
GRANT ALL ON public.alexa_devices TO service_role;
ALTER TABLE public.alexa_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alexa devices" ON public.alexa_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER alexa_devices_updated BEFORE UPDATE ON public.alexa_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.alexa_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_sync boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer NOT NULL DEFAULT 15,
  debug_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alexa_settings TO authenticated;
GRANT ALL ON public.alexa_settings TO service_role;
ALTER TABLE public.alexa_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alexa settings" ON public.alexa_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER alexa_settings_updated BEFORE UPDATE ON public.alexa_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.alexa_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer,
  duration_ms integer,
  ok boolean NOT NULL DEFAULT false,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alexa_sync_log_user_created_idx ON public.alexa_sync_log (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.alexa_sync_log TO authenticated;
GRANT ALL ON public.alexa_sync_log TO service_role;
ALTER TABLE public.alexa_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alexa sync log" ON public.alexa_sync_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);