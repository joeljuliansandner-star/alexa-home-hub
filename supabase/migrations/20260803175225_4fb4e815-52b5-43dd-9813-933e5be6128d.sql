ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS model text;

CREATE UNIQUE INDEX IF NOT EXISTS devices_user_external_id_idx
  ON public.devices (user_id, external_id)
  WHERE external_id IS NOT NULL;