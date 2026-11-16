import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { validateMeasurementRow } from "@/lib/validation/measurement";
import { calculateAllZScores } from "@/lib/zscore";
import {
  evaluateHealthRulesAndProfile,
  type VisitHistoryEntry,
} from "@/lib/rules";
import { diffCorrectedFields, logExtractionAttempt } from "@/lib/ai/extraction-logger";
import { logger } from "@/lib/logger";
import type {
  DataSource,
  ExtractedVisitRow,
  HealthProfile,
  IndicatorType,
  Measurement,
  MeasurementMethod,
  Sex,
  ZScoreResult,
} from "@/lib/types";

interface SaveMeasurementRowPayload {
  baris_index?: number;
  tgl_ukur: string;
  bb_kg: number;
  pb_tb_cm?: number | null;
  cara_ukur?: MeasurementMethod | null;
  lk_cm?: number | null;
  lila_cm?: number | null;
  imunisasi?: string | null;
  asi_eksklusif?: boolean | null;
}

interface SaveMeasurementsBody {
  child_id: string;
  sumber: DataSource;
  foto_ref?: string | null;
  extraction_job_id?: string | null;
  model_used?: string | null;
  prompt_version?: string | null;
  original_rows?: ExtractedVisitRow[];
  rows: SaveMeasurementRowPayload[];
}

/**
 * POST /api/measurements (Fase 2 - B9)
 * Menyimpan hasil verifikasi Kader (dari ekstraksi AI maupun input manual),
 * memvalidasi plausibilitas, menghitung Z-Score deterministik (Permenkes 2/2020),
 * serta mencatat koreksi manual ke `extraction_logs` untuk KPI-6.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || !session.profile.status_aktif) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau akun telah dinonaktifkan." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as SaveMeasurementsBody;
    const {
      child_id: childId,
      sumber,
      foto_ref: fotoRef = null,
      extraction_job_id: extractionJobId = null,
      model_used: modelUsed = null,
      prompt_version: promptVersion = null,
      original_rows: originalRows = [],
      rows,
    } = body;

    if (!childId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Data child_id dan minimal satu baris pengukuran wajib diisi." },
        { status: 400 }
      );
    }

    if (sumber !== "AI" && sumber !== "manual") {
      return NextResponse.json(
        { error: "Sumber data harus bernilai 'AI' atau 'manual'." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Verifikasi akses balita melalui RLS pengguna saat ini
    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("id, tgl_lahir, jenis_kelamin, posyandu_id")
      .eq("id", childId)
      .maybeSingle();

    if (childErr) {
      return NextResponse.json({ error: childErr.message }, { status: 500 });
    }

    if (!child) {
      return NextResponse.json(
        { error: "Data balita tidak ditemukan atau di luar wilayah Posyandu Anda." },
        { status: 404 }
      );
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    // 2. Validasi seluruh baris (plausibilitas + rentang usia 0-59 bulan + cek duplikat antar baris payload)
    const payloadDates = new Set<string>();
    const validationErrors: string[] = [];
    const computedAges: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const check = validateMeasurementRow(
        {
          tgl_ukur: r.tgl_ukur,
          bb_kg: r.bb_kg,
          pb_tb_cm: r.pb_tb_cm ?? null,
          cara_ukur: r.cara_ukur ?? null,
          lk_cm: r.lk_cm ?? null,
          lila_cm: r.lila_cm ?? null,
          imunisasi: r.imunisasi ?? null,
          asi_eksklusif: r.asi_eksklusif ?? null,
        },
        child.tgl_lahir,
        todayIso
      );

      if (!check.valid || check.ageMonths === null) {
        validationErrors.push(`Baris ${i + 1}: ${check.errors.join(" ")}`);
      } else {
        computedAges.push(check.ageMonths);
      }

      if (r.tgl_ukur) {
        if (payloadDates.has(r.tgl_ukur)) {
          validationErrors.push(
            `Baris ${i + 1}: Terdapat tanggal pengukuran ganda (${r.tgl_ukur}) dalam satu kiriman.`
          );
        }
        payloadDates.add(r.tgl_ukur);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join(" | "), details: validationErrors },
        { status: 400 }
      );
    }

    // 3. Cek duplikat tanggal di basis data
    const { data: existingRows } = await supabase
      .from("measurements")
      .select("tgl_ukur")
      .eq("child_id", childId)
      .in("tgl_ukur", Array.from(payloadDates));

    if (existingRows && existingRows.length > 0) {
      const dupDates = existingRows.map((d) => d.tgl_ukur).join(", ");
      return NextResponse.json(
        {
          error: `Pengukuran pada tanggal ${dupDates} sudah tercatat untuk balita ini.`,
        },
        { status: 409 }
      );
    }

    // 4. Simpan setiap baris ke `measurements` dan hitung Z-Score deterministik
    const nowIso = new Date().toISOString();
    const savedMeasurements = [];
    const savedZScores: ZScoreResult[] = [];
    const lilaClassifications: Array<{ tgl_ukur: string; status: string | null }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const usiaBulan = computedAges[i];
      if (!r || usiaBulan === undefined) continue;

      const { data: insertedMeasurement, error: insertErr } = await supabase
        .from("measurements")
        .insert({
          child_id: childId,
          tgl_ukur: r.tgl_ukur,
          usia_bulan: usiaBulan,
          bb_kg: r.bb_kg,
          pb_tb_cm: r.pb_tb_cm ?? null,
          cara_ukur: r.cara_ukur ?? null,
          lk_cm: r.lk_cm ?? null,
          lila_cm: r.lila_cm ?? null,
          imunisasi: r.imunisasi?.trim() || null,
          asi_eksklusif: r.asi_eksklusif ?? null,
          sumber,
          verified_by: session.authUserId,
          verified_at: nowIso,
          foto_ref: fotoRef,
        })
        .select("*")
        .single();

      if (insertErr || !insertedMeasurement) {
        return NextResponse.json(
          { error: insertErr?.message ?? "Gagal menyimpan data pengukuran." },
          { status: 500 }
        );
      }

      savedMeasurements.push(insertedMeasurement);

      // Hitung Z-Score deterministik (Permenkes 2/2020 / WHO 2006)
      const zOutput = calculateAllZScores({
        birthDate: child.tgl_lahir,
        measureDate: r.tgl_ukur,
        sex: child.jenis_kelamin as Sex,
        weightKg: r.bb_kg,
        pbTbCm: r.pb_tb_cm ?? null,
        measurementMethod: r.cara_ukur ?? null,
        headCircumferenceCm: r.lk_cm ?? null,
        armCircumferenceCm: r.lila_cm ?? null,
      });

      const activeIndicators: IndicatorType[] = [
        "BB/U",
        zOutput.activeLengthHeightIndicator,
        zOutput.activeWeightLengthHeightIndicator,
        "IMT/U",
      ];
      if (r.lk_cm !== null && r.lk_cm !== undefined) {
        activeIndicators.push("LK/U");
      }

      const zscoreRowsToInsert = activeIndicators.map((ind) => {
        const res = zOutput.results[ind];
        return {
          measurement_id: insertedMeasurement.id,
          indikator: res.indikator,
          nilai_z: res.nilai_z,
          klasifikasi: res.klasifikasi,
          flag_biologis_tidak_mungkin: res.flag_biologis_tidak_mungkin,
          koreksi_cara_ukur_cm: res.koreksi_cara_ukur_cm,
          versi_tabel: res.versi_tabel,
        };
      });

      const { data: insertedZ, error: zErr } = await adminClient
        .from("zscores")
        .insert(zscoreRowsToInsert)
        .select("*");

      if (zErr) {
        logger.error("Gagal menyimpan hasil Z-Score", {
          measurementId: insertedMeasurement.id,
          error: zErr.message,
        });
      } else if (insertedZ) {
        savedZScores.push(...(insertedZ as ZScoreResult[]));
      }

      lilaClassifications.push({
        tgl_ukur: r.tgl_ukur,
        status: zOutput.lilaClassification,
      });

      // Catat koreksi manual Kader pada ekstraksi AI untuk pelacakan KPI-6
      if (sumber === "AI" && extractionJobId) {
        const matchedOriginal = originalRows.find(
          (orig) =>
            (r.baris_index !== undefined && orig.baris_index === r.baris_index) ||
            orig.tgl_ukur.value === r.tgl_ukur
        );

        if (matchedOriginal) {
          const corrections = diffCorrectedFields(matchedOriginal, {
            tgl_ukur: r.tgl_ukur,
            bb_kg: r.bb_kg,
            pb_tb_cm: r.pb_tb_cm ?? null,
            cara_ukur: r.cara_ukur ?? null,
            lk_cm: r.lk_cm ?? null,
            lila_cm: r.lila_cm ?? null,
            imunisasi: r.imunisasi ?? null,
            asi_eksklusif: r.asi_eksklusif ?? null,
          });

          await logExtractionAttempt(
            {
              measurement_id: insertedMeasurement.id,
              extraction_job_id: extractionJobId,
              model: modelUsed ?? "verified-by-kader",
              versi_prompt: promptVersion ?? "kia-extraction-v1.0",
              field_dikoreksi: corrections,
              latensi_ms: 0,
              estimasi_biaya_usd: 0,
            },
            { supabaseClient: adminClient }
          );
        }
      }
    }

    // 5. Tandai extraction_jobs selesai diverifikasi dan disimpan
    if (sumber === "AI" && extractionJobId) {
      await adminClient
        .from("extraction_jobs")
        .update({
          status: "disimpan",
          verified_at: nowIso,
        })
        .eq("id", extractionJobId);
    }

    // 6. Evaluasi aturan R1-R8 & perbarui health_profiles + alerts (Fase 3 - B6 & B7)
    let latestHealthProfile: HealthProfile | null = null;
    const createdAlerts: Array<Record<string, unknown>> = [];

    const { data: allChildMeasurements } = await adminClient
      .from("measurements")
      .select("*")
      .eq("child_id", childId)
      .order("tgl_ukur", { ascending: true });

    if (allChildMeasurements && allChildMeasurements.length > 0) {
      const mIds = allChildMeasurements.map((m) => m.id as string);
      const { data: allChildZScores } = await adminClient
        .from("zscores")
        .select("*")
        .in("measurement_id", mIds);

      const zByMeasurement = new Map<string, ZScoreResult[]>();
      for (const z of (allChildZScores ?? []) as ZScoreResult[]) {
        const mid = z.measurement_id ?? "";
        const list = zByMeasurement.get(mid) ?? [];
        list.push(z);
        zByMeasurement.set(mid, list);
      }

      const history: VisitHistoryEntry[] = (allChildMeasurements as Measurement[]).map(
        (m) => ({
          measurement: m,
          zscores: zByMeasurement.get(m.id) ?? [],
        })
      );

      for (const savedM of savedMeasurements) {
        const evaluated = evaluateHealthRulesAndProfile({
          sex: child.jenis_kelamin as Sex,
          history,
          targetMeasurementId: savedM.id as string,
        });

        const { data: upsertedProfile, error: hpErr } = await adminClient
          .from("health_profiles")
          .upsert(
            {
              child_id: childId,
              measurement_id: evaluated.measurementId,
              status_keseluruhan: evaluated.statusKeseluruhan,
              status_per_indikator: evaluated.statusPerIndikator,
              status_lila: evaluated.statusLila,
              aturan_terpicu: evaluated.aturanTerpicu,
              tren_bb: evaluated.trenBb,
              dihitung_pada: nowIso,
            },
            { onConflict: "measurement_id" }
          )
          .select("*")
          .single();

        if (hpErr) {
          logger.error("Gagal menyimpan health_profiles", {
            measurementId: savedM.id,
            error: hpErr.message,
          });
        } else if (upsertedProfile) {
          latestHealthProfile = upsertedProfile as HealthProfile;
        }

        if (evaluated.aturanTerpicu.length > 0) {
          const alertRows = evaluated.aturanTerpicu.map((rule) => ({
            child_id: childId,
            measurement_id: evaluated.measurementId,
            kode_aturan: rule.kode,
            tingkat: rule.tingkat,
            pesan_awam: rule.alasan_awam,
            status_kirim: "ditampilkan_aplikasi",
          }));

          const { data: insertedAlerts, error: alertErr } = await adminClient
            .from("alerts")
            .upsert(alertRows, {
              onConflict: "measurement_id,kode_aturan",
              ignoreDuplicates: true,
            })
            .select("*");

          if (alertErr) {
            logger.error("Gagal menyimpan alerts", {
              measurementId: savedM.id,
              error: alertErr.message,
            });
          } else if (insertedAlerts) {
            createdAlerts.push(...insertedAlerts);
          }
        }
      }
    }

    return NextResponse.json(
      {
        measurements: savedMeasurements,
        zscores: savedZScores,
        lilaClassifications,
        healthProfile: latestHealthProfile,
        alerts: createdAlerts,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi galat saat menyimpan data pengukuran.";
    logger.error("Unhandled error on POST /api/measurements", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
