ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own user data." ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own user data." ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own licenses." ON licenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own licenses." ON licenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own licenses." ON licenses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own devices." ON devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own devices." ON devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own devices." ON devices FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own devices." ON devices FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own entitlements." ON entitlements FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE revoked_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only authenticated users can view revoked licenses." ON revoked_licenses FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only authenticated users can view audit logs." ON audit_logs FOR SELECT USING (auth.role() = 'authenticated');