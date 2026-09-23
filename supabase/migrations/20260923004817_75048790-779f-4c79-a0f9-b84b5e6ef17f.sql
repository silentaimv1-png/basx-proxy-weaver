CREATE POLICY "backend_only" ON public.relay_requests FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "backend_only" ON public.relay_responses FOR ALL USING (false) WITH CHECK (false);