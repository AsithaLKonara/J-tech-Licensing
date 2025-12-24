
-- RLS for public.licenses table
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own licenses" ON public.licenses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Edge Functions can insert licenses" ON public.licenses
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions, RLS will be bypassed by service_role if needed or enforced by Edge Function logic

CREATE POLICY "Edge Functions can update licenses" ON public.licenses
FOR UPDATE USING (true); -- Managed by Edge Functions

-- RLS for public.devices table
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.devices
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON public.devices
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON public.devices
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" ON public.devices
FOR DELETE USING (auth.uid() = user_id);

-- RLS for public.entitlements table
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entitlements" ON public.entitlements
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Edge Functions can insert entitlements" ON public.entitlements
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions

CREATE POLICY "Edge Functions can update entitlements" ON public.entitlements
FOR UPDATE USING (true); -- Managed by Edge Functions

-- RLS for public.revoked_licenses table
ALTER TABLE public.revoked_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users cannot directly access revoked licenses" ON public.revoked_licenses
FOR SELECT USING (false); -- Only Edge Functions can access

CREATE POLICY "Edge Functions can insert revoked licenses" ON public.revoked_licenses
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions

-- RLS for public.audit_logs table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Edge Functions can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions

