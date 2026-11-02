import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Helper untuk membaca file .env.local jika belum dimuat ke environment
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "your-supabase-service-role-key") {
  console.error("❌ Galat: SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local.");
  console.error("Harap isi SUPABASE_SERVICE_ROLE_KEY dari Supabase Dashboard Project Settings -> API.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log("🌱 Memulai pengisian data awal (seeding) Supabase Posyandu+...");

  const baseDir = process.cwd();

  // --------------------------------------------------------------------------
  // 1. Seed ref_lms
  // --------------------------------------------------------------------------
  console.log("1. Mengimpor tabel referensi ref_lms.csv...");
  const lmsCsvPath = path.join(baseDir, "ref", "ref_lms.csv");
  if (fs.existsSync(lmsCsvPath)) {
    const lmsRows = fs
      .readFileSync(lmsCsvPath, "utf-8")
      .replace(/\r/g, "")
      .trim()
      .split("\n")
      .slice(1); // Lewati header

    const batchSize = 200;
    const records = lmsRows
      .map((line) => {
        const parts = line.split(",");
        if (parts.length < 6) return null;
        const [indikator = "", jenis_kelamin = "", x = "0", l = "0", m = "0", s = "0"] = parts;
        return {
          indikator: indikator.trim(),
          jenis_kelamin: jenis_kelamin.trim(),
          x: parseFloat(x),
          l: parseFloat(l),
          m: parseFloat(m),
          s: parseFloat(s),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      const { error } = await supabase.from("ref_lms").upsert(chunk, {
        onConflict: "indikator,jenis_kelamin,x",
      });
      if (error) {
        console.error(`   ⚠️ Gagal upsert ref_lms chunk ${i}:`, error.message);
      }
    }
    console.log(`   ✅ Selesai mengimpor ${records.length} baris ref_lms.`);
  }

  // --------------------------------------------------------------------------
  // 2. Seed ref_kbm
  // --------------------------------------------------------------------------
  console.log("2. Mengimpor tabel referensi ref_kbm.csv...");
  const kbmCsvPath = path.join(baseDir, "ref", "ref_kbm.csv");
  if (fs.existsSync(kbmCsvPath)) {
    const kbmRows = fs
      .readFileSync(kbmCsvPath, "utf-8")
      .replace(/\r/g, "")
      .trim()
      .split("\n")
      .slice(1);

    const records = kbmRows
      .map((line) => {
        const parts = line.split(",");
        if (parts.length < 4) return null;
        const [sex = "", age_month_min = "0", age_month_max = "0", kbm_gram = "0"] = parts;
        return {
          jenis_kelamin: sex.trim(),
          usia_bulan_min: parseInt(age_month_min, 10),
          usia_bulan_max: parseInt(age_month_max, 10),
          kbm_gram: parseInt(kbm_gram, 10),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const { error } = await supabase.from("ref_kbm").upsert(records, {
      onConflict: "jenis_kelamin,usia_bulan_min,usia_bulan_max",
    });
    if (error) {
      console.error("   ⚠️ Gagal upsert ref_kbm:", error.message);
    } else {
      console.log(`   ✅ Selesai mengimpor ${records.length} baris ref_kbm.`);
    }
  }

  // --------------------------------------------------------------------------
  // 3. Seed ref_kms_line
  // --------------------------------------------------------------------------
  console.log("3. Mengimpor tabel referensi ref_kms_line.csv...");
  const kmsCsvPath = path.join(baseDir, "ref", "ref_kms_line.csv");
  if (fs.existsSync(kmsCsvPath)) {
    const kmsRows = fs
      .readFileSync(kmsCsvPath, "utf-8")
      .replace(/\r/g, "")
      .trim()
      .split("\n")
      .slice(1);

    const records = kmsRows
      .map((line) => {
        const parts = line.split(",");
        if (parts.length < 5) return null;
        const [sex = "", chart = "", age_month = "0", red_line_kg = "0", orange_line_kg = "0"] = parts;
        return {
          jenis_kelamin: sex.trim(),
          grafik: chart.trim(),
          usia_bulan: parseInt(age_month, 10),
          garis_merah_kg: parseFloat(red_line_kg),
          garis_oranye_kg: parseFloat(orange_line_kg),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const { error } = await supabase.from("ref_kms_line").upsert(records, {
      onConflict: "jenis_kelamin,grafik,usia_bulan",
    });
    if (error) {
      console.error("   ⚠️ Gagal upsert ref_kms_line:", error.message);
    } else {
      console.log(`   ✅ Selesai mengimpor ${records.length} baris ref_kms_line.`);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Seed Posyandu (Desa Kerobokan, Buleleng)
  // --------------------------------------------------------------------------
  console.log("4. Membuat data Posyandu uji...");
  const posyanduData = [
    {
      nama: "Posyandu Dalem",
      dusun_banjar: "Banjar Dinas Dalem",
      wilayah_puskesmas: "Puskesmas Sawan I",
    },
    {
      nama: "Posyandu Kloncing",
      dusun_banjar: "Banjar Dinas Kloncing",
      wilayah_puskesmas: "Puskesmas Sawan I",
    },
  ];

  const posyanduList: { id: string; nama: string }[] = [];
  for (const pos of posyanduData) {
    const { data: existing } = await supabase
      .from("posyandu")
      .select("id, nama")
      .eq("nama", pos.nama)
      .maybeSingle();

    if (existing) {
      posyanduList.push(existing);
    } else {
      const { data: created, error } = await supabase
        .from("posyandu")
        .insert(pos)
        .select("id, nama")
        .single();
      if (error) {
        console.error(`   ⚠️ Gagal buat posyandu ${pos.nama}:`, error.message);
      } else if (created) {
        posyanduList.push(created);
      }
    }
  }
  console.log(`   ✅ Posyandu siap: ${posyanduList.map((p) => p.nama).join(", ")}`);

  const posyanduDalem = posyanduList.find((p) => p.nama === "Posyandu Dalem");
  const posyanduKloncing = posyanduList.find((p) => p.nama === "Posyandu Kloncing");

  // --------------------------------------------------------------------------
  // 5. Seed Akun Pengguna Uji (Supabase Auth & public.users)
  // --------------------------------------------------------------------------
  console.log("5. Membuat akun pengguna uji (1 Bidan, 2 Kader)...");
  const defaultPassword = "PosyanduPlus2026!";

  const usersToSeed = [
    {
      email: "bidan.kerobokan@posyanduplus.local",
      nama: "Bidan Ni Wayan Suratni",
      peran: "bidan" as const,
      posyandu_ditugaskan: null,
    },
    {
      email: "kader.dalem@posyanduplus.local",
      nama: "Kader Ketut Sariani",
      peran: "kader" as const,
      posyandu_ditugaskan: posyanduDalem?.id || null,
    },
    {
      email: "kader.kloncing@posyanduplus.local",
      nama: "Kader Made Sukartini",
      peran: "kader" as const,
      posyandu_ditugaskan: posyanduKloncing?.id || null,
    },
  ];

  for (const u of usersToSeed) {
    // Periksa apakah user sudah ada di Auth
    const { data: listData } = await supabase.auth.admin.listUsers();
    let authUser = listData?.users.find((x) => x.email === u.email);

    if (!authUser) {
      const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { nama: u.nama, peran: u.peran },
      });
      if (authError) {
        console.error(`   ⚠️ Gagal buat auth user ${u.email}:`, authError.message);
        continue;
      }
      authUser = createdAuth.user;
    }

    if (authUser) {
      const { error: profileError } = await supabase.from("users").upsert({
        id: authUser.id,
        peran: u.peran,
        nama: u.nama,
        email: u.email,
        status_aktif: true,
        posyandu_ditugaskan: u.posyandu_ditugaskan,
      });

      if (profileError) {
        console.error(`   ⚠️ Gagal upsert profil user ${u.email}:`, profileError.message);
      } else {
        console.log(`   ✅ User siap: ${u.nama} (${u.email}) [Peran: ${u.peran}]`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. Seed Balita Sintetis (Children)
  // --------------------------------------------------------------------------
  console.log("6. Membuat data balita sintetis...");
  if (posyanduDalem && posyanduKloncing) {
    const childrenToSeed: Array<{
      nama: string;
      tgl_lahir: string;
      jenis_kelamin: "M" | "F";
      nama_ortu: string;
      posyandu_id: string;
      banjar: string;
      consent_at: string;
    }> = [
      {
        nama: "I Gede Rama Sanjaya",
        tgl_lahir: "2025-10-15",
        jenis_kelamin: "M",
        nama_ortu: "I Made Sanjaya",
        posyandu_id: posyanduDalem.id,
        banjar: "Banjar Dinas Dalem",
        consent_at: new Date().toISOString(),
      },
      {
        nama: "Ni Kadek Ayu Lestari",
        tgl_lahir: "2025-03-20",
        jenis_kelamin: "F",
        nama_ortu: "Ni Ketut Suartini",
        posyandu_id: posyanduDalem.id,
        banjar: "Banjar Dinas Dalem",
        consent_at: new Date().toISOString(),
      },
      {
        nama: "I Komang Aditya Putra",
        tgl_lahir: "2026-02-10",
        jenis_kelamin: "M",
        nama_ortu: "I Wayan Putra",
        posyandu_id: posyanduKloncing.id,
        banjar: "Banjar Dinas Kloncing",
        consent_at: new Date().toISOString(),
      },
      {
        nama: "Ni Nyoman Putri Dewi",
        tgl_lahir: "2025-08-05",
        jenis_kelamin: "F",
        nama_ortu: "I Gede Dewi",
        posyandu_id: posyanduKloncing.id,
        banjar: "Banjar Dinas Kloncing",
        consent_at: new Date().toISOString(),
      },
    ];

    for (const child of childrenToSeed) {
      const { data: existing } = await supabase
        .from("children")
        .select("id")
        .eq("posyandu_id", child.posyandu_id)
        .eq("nama", child.nama)
        .maybeSingle();

      if (!existing) {
        await supabase.from("children").insert(child);
      }
    }
    console.log(`   ✅ Selesai membuat ${childrenToSeed.length} balita sintetis.`);
  }

  console.log("\n🎉 Seeding selesai dengan sukses!");
  console.log(`Kredensial login akun uji (Password: ${defaultPassword}):`);
  console.log("- Bidan : bidan.kerobokan@posyanduplus.local (Seluruh Posyandu)");
  console.log("- Kader A: kader.dalem@posyanduplus.local (Posyandu Dalem)");
  console.log("- Kader B: kader.kloncing@posyanduplus.local (Posyandu Kloncing)");
}

seed().catch((err) => {
  console.error("❌ Terjadi kesalahan fatal saat seeding:", err);
  process.exit(1);
});
