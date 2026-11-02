-- ==============================================================================
-- Migrasi 003: Pemicu Audit Log & Penegakan Alasan Wajib Bidan (F1-07)
-- Acuan: PRD Posyandu+ v2.2 Bab 3, Bab 5 (FR1), Bab 7 (audit_logs)
-- ==============================================================================

-- Fungsi pembantu RPC untuk menyetel alasan audit pada transaksi saat ini
CREATE OR REPLACE FUNCTION public.set_audit_reason(reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF reason IS NULL OR length(trim(reason)) = 0 THEN
    RAISE EXCEPTION 'Alasan audit tidak boleh kosong.';
  END IF;
  PERFORM set_config('app.audit_reason', trim(reason), true);
END;
$$;

-- Fungsi Trigger Audit untuk menangkap perubahan data rekam medis oleh Bidan
CREATE OR REPLACE FUNCTION public.audit_bidan_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_reason TEXT;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();
  
  -- Jika query dijalankan di luar konteks autentikasi pengguna (misal skrip migrasi superuser), lewati
  IF v_actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT peran INTO v_role FROM public.users WHERE id = v_actor;

  -- Pemeriksaan dan pencatatan audit aktif khusus untuk peran Bidan
  IF v_role = 'bidan' THEN
    v_reason := NULLIF(trim(current_setting('app.audit_reason', true)), '');

    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'Koreksi data rekam medis oleh Bidan wajib menyertakan alasan (alasan tidak boleh kosong).';
    END IF;

    -- Catat jejak perubahan ke tabel audit_logs
    INSERT INTO public.audit_logs (
      aktor,
      aksi,
      entitas,
      entitas_id,
      nilai_lama,
      nilai_baru,
      alasan,
      waktu
    ) VALUES (
      v_actor,
      TG_OP,
      TG_TABLE_NAME,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      v_reason,
      now()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Pasang pemicu audit pada tabel rekam medis utama
DROP TRIGGER IF EXISTS trg_audit_measurements ON public.measurements;
CREATE TRIGGER trg_audit_measurements
    BEFORE UPDATE OR DELETE ON public.measurements
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_bidan_changes();

DROP TRIGGER IF EXISTS trg_audit_children ON public.children;
CREATE TRIGGER trg_audit_children
    BEFORE UPDATE OR DELETE ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_bidan_changes();

DROP TRIGGER IF EXISTS trg_audit_education ON public.education;
CREATE TRIGGER trg_audit_education
    BEFORE UPDATE OR DELETE ON public.education
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_bidan_changes();

