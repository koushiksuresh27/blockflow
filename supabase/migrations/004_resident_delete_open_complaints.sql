-- Migration: Allow residents to delete their own open complaints
-- Residents may only delete complaints they submitted while still in 'open' status
-- (i.e., not yet assigned, in-progress, or completed)

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints: residents can delete own open"
  ON public.complaints FOR DELETE
  USING (
    submitted_by = auth.uid()
    AND status = 'open'
  );
