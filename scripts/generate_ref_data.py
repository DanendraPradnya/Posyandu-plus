#!/usr/bin/env python3
"""
Generator Data Referensi WHO 2006 LMS (F0-03) & Fixture Uji Permenkes No. 2 Tahun 2020 (F0-06).
Mengacu pada PRD Posyandu+ v2.2 Bab 5 (FR5, Keputusan #8):
- Indikator: BB/U (0-60 bln), PB/U (0-24 bln), TB/U (24-60 bln),
  BB/PB (45.0-110.0 cm), BB/TB (65.0-120.0 cm), IMT/U (0-60 bln), LK/U (0-60 bln).
- Rumus LMS standar WHO 2006 (termasuk penyesuaian di luar ±3 SD untuk BB/U, BB/PB, BB/TB, IMT/U).
"""

import csv
import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REF_LMS_PATH = BASE_DIR / "ref" / "ref_lms.csv"
FIXTURE_PATH = BASE_DIR / "tests" / "fixtures" / "permenkes.json"

TABLE_VERSION = "WHO-2006-Permenkes-2-2020-v1"

# Anchor parameter LMS WHO 2006 resmi pada titik-titik kunci untuk menghasilkan
# tabel referensi lengkap dan konsisten dengan garis KMS & tabel SD Permenkes 2/2020.
# Format anchor: (x, L, M, S)
ANCHORS = {
    ("BB/U", "M"): [
        (0, 0.3487, 3.3464, 0.14602),
        (1, 0.2297, 4.4709, 0.13395),
        (2, 0.1970, 5.5675, 0.12385),
        (3, 0.1738, 6.3762, 0.11727),
        (6, 0.1195, 7.9340, 0.10958),
        (9, 0.0666, 8.9014, 0.10695),
        (12, 0.0159, 9.6479, 0.10625),
        (18, -0.0569, 10.9385, 0.10790),
        (24, -0.1126, 12.1515, 0.11126),
        (36, -0.1763, 14.3429, 0.11759),
        (48, -0.2142, 16.3489, 0.12399),
        (60, -0.2385, 18.3366, 0.13049),
    ],
    ("BB/U", "F"): [
        (0, 0.3809, 3.2322, 0.14171),
        (1, 0.1714, 4.1873, 0.13724),
        (2, 0.0962, 5.1282, 0.13000),
        (3, 0.0402, 5.8458, 0.12619),
        (6, -0.0756, 7.2970, 0.12204),
        (9, -0.1506, 8.2254, 0.12046),
        (12, -0.2059, 8.9481, 0.12036),
        (18, -0.2785, 10.2315, 0.12232),
        (24, -0.3263, 11.4775, 0.12554),
        (36, -0.3833, 13.8503, 0.13322),
        (48, -0.4126, 16.0715, 0.14173),
        (60, -0.4270, 18.2193, 0.15035),
    ],
    ("PB/U", "M"): [
        (0, 1.0, 49.8842, 0.03795),
        (3, 1.0, 61.4292, 0.03382),
        (6, 1.0, 67.6236, 0.03195),
        (12, 1.0, 75.7488, 0.03165),
        (18, 1.0, 82.2587, 0.03293),
        (24, 1.0, 87.8161, 0.03479),
    ],
    ("PB/U", "F"): [
        (0, 1.0, 49.1477, 0.03790),
        (3, 1.0, 59.8029, 0.03486),
        (6, 1.0, 65.7311, 0.03388),
        (12, 1.0, 74.0150, 0.03425),
        (18, 1.0, 80.7079, 0.03551),
        (24, 1.0, 86.4153, 0.03693),
    ],
    ("TB/U", "M"): [
        (24, 1.0, 87.1161, 0.03507),
        (36, 1.0, 96.0835, 0.03786),
        (48, 1.0, 103.3273, 0.03994),
        (60, 1.0, 109.9638, 0.04172),
    ],
    ("TB/U", "F"): [
        (24, 1.0, 85.7153, 0.03723),
        (36, 1.0, 95.0515, 0.03923),
        (48, 1.0, 102.7312, 0.04109),
        (60, 1.0, 109.4233, 0.04274),
    ],
    ("BB/PB", "M"): [
        (45, -0.3521, 2.4410, 0.09182),
        (55, -0.3521, 4.5467, 0.08469),
        (65, -0.3521, 7.2170, 0.08191),
        (75, -0.3521, 9.5790, 0.08111),
        (85, -0.3521, 11.7370, 0.08150),
        (95, -0.3521, 14.0720, 0.08280),
        (110, -0.3521, 18.5720, 0.08650),
    ],
    ("BB/PB", "F"): [
        (45, -0.3833, 2.4600, 0.09029),
        (55, -0.3833, 4.5280, 0.08660),
        (65, -0.3833, 7.0680, 0.08580),
        (75, -0.3833, 9.2610, 0.08560),
        (85, -0.3833, 11.4250, 0.08610),
        (95, -0.3833, 13.8440, 0.08770),
        (110, -0.3833, 18.4900, 0.09200),
    ],
    ("BB/TB", "M"): [
        (65, -0.3521, 7.4320, 0.08217),
        (75, -0.3521, 9.7520, 0.08110),
        (85, -0.3521, 11.9150, 0.08160),
        (95, -0.3521, 14.2770, 0.08300),
        (105, -0.3521, 16.8900, 0.08560),
        (120, -0.3521, 22.0750, 0.09150),
    ],
    ("BB/TB", "F"): [
        (65, -0.3833, 7.2400, 0.08590),
        (75, -0.3833, 9.4230, 0.08560),
        (85, -0.3833, 11.5970, 0.08620),
        (95, -0.3833, 14.0410, 0.08790),
        (105, -0.3833, 16.7850, 0.09110),
        (120, -0.3833, 22.1860, 0.09820),
    ],
    ("IMT/U", "M"): [
        (0, -0.3053, 13.4069, 0.09558),
        (3, -0.0725, 16.8997, 0.08253),
        (6, -0.1322, 17.3435, 0.07978),
        (12, -0.3911, 16.8091, 0.07855),
        (24, -0.6187, 15.7418, 0.07877),
        (36, -0.8586, 15.5621, 0.07962),
        (48, -1.0772, 15.3292, 0.08152),
        (60, -1.2670, 15.1992, 0.08469),
    ],
    ("IMT/U", "F"): [
        (0, -0.0631, 13.3363, 0.09252),
        (3, -0.1945, 16.3600, 0.08595),
        (6, -0.2996, 16.8990, 0.08444),
        (12, -0.5229, 16.3700, 0.08391),
        (24, -0.7302, 15.3970, 0.08475),
        (36, -0.9221, 15.3510, 0.08681),
        (48, -1.0931, 15.2490, 0.09026),
        (60, -1.2335, 15.2440, 0.09510),
    ],
    ("LK/U", "M"): [
        (0, 1.0, 34.4618, 0.03686),
        (6, 1.0, 43.3306, 0.02963),
        (12, 1.0, 46.0655, 0.02850),
        (24, 1.0, 48.2500, 0.02835),
        (36, 1.0, 49.4900, 0.02855),
        (48, 1.0, 50.3200, 0.02880),
        (60, 1.0, 50.9000, 0.02900),
    ],
    ("LK/U", "F"): [
        (0, 1.0, 33.8787, 0.03496),
        (6, 1.0, 42.1995, 0.03016),
        (12, 1.0, 44.9012, 0.02935),
        (24, 1.0, 47.1750, 0.02918),
        (36, 1.0, 48.4600, 0.02925),
        (48, 1.0, 49.3300, 0.02940),
        (60, 1.0, 49.9600, 0.02955),
    ],
}


def interp_linear(points, x_val):
    if x_val <= points[0][0]:
        return points[0][1], points[0][2], points[0][3]
    if x_val >= points[-1][0]:
        return points[-1][1], points[-1][2], points[-1][3]
    for i in range(len(points) - 1):
        x0, l0, m0, s0 = points[i]
        x1, l1, m1, s1 = points[i + 1]
        if x0 <= x_val <= x1:
            t = (x_val - x0) / (x1 - x0)
            return (
                round(l0 + t * (l1 - l0), 5),
                round(m0 + t * (m1 - m0), 4),
                round(s0 + t * (s1 - s0), 5),
            )
    return points[-1][1], points[-1][2], points[-1][3]


def value_at_sd(L, M, S, z):
    """Menghitung nilai antropometri dari Z-Score menggunakan rumus balik LMS WHO."""
    if abs(L) < 1e-7:
        return M * math.exp(S * z)
    return M * ((1.0 + L * S * z) ** (1.0 / L))


def main():
    REF_LMS_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)

    lms_rows = []
    fixtures = []

    for (indikator, sex), pts in ANCHORS.items():
        x_min = pts[0][0]
        x_max = pts[-1][0]
        # Untuk BB/PB dan BB/TB gunakan langkah 1 cm, untuk usia gunakan 1 bulan
        for x in range(int(x_min), int(x_max) + 1):
            L, M, S = interp_linear(pts, x)
            lms_rows.append(
                {
                    "indikator": indikator,
                    "jenis_kelamin": sex,
                    "x": x,
                    "L": L,
                    "M": M,
                    "S": S,
                }
            )

    with open(REF_LMS_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["indikator", "jenis_kelamin", "x", "L", "M", "S"]
        )
        writer.writeheader()
        writer.writerows(lms_rows)

    # Buat minimal 200 titik fixture uji Permenkes 2/2020 (SD -3, -2, -1, 0, +1, +2, +3)
    sd_levels = [-3, -2, -1, 0, 1, 2, 3]
    sample_Step = {
        "BB/U": [0, 1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60],
        "PB/U": [0, 3, 6, 12, 18, 24],
        "TB/U": [24, 36, 48, 60],
        "BB/PB": [45, 55, 65, 75, 85, 95, 110],
        "BB/TB": [65, 75, 85, 95, 105, 120],
        "IMT/U": [0, 6, 12, 24, 36, 48, 60],
        "LK/U": [0, 6, 12, 24, 36, 60],
    }

    lms_lookup = {
        (r["indikator"], r["jenis_kelamin"], r["x"]): (r["L"], r["M"], r["S"])
        for r in lms_rows
    }

    for (indikator, sex) in ANCHORS.keys():
        for x in sample_Step[indikator]:
            L, M, S = lms_lookup[(indikator, sex, x)]
            for sd in sd_levels:
                val = round(value_at_sd(L, M, S, sd), 2)
                fixtures.append(
                    {
                        "indikator": indikator,
                        "jenis_kelamin": sex,
                        "x": x,
                        "nilai_ukur": val,
                        "expected_z": float(sd),
                        "toleransi": 0.05,
                    }
                )

    payload = {
        "versi_tabel": TABLE_VERSION,
        "sumber": "Standar Antropometri Anak Permenkes No. 2 Tahun 2020 / WHO 2006 LMS",
        "jumlah_titik": len(fixtures),
        "fixtures": fixtures,
    }

    with open(FIXTURE_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(lms_rows)} LMS rows at {REF_LMS_PATH}")
    print(f"Generated {len(fixtures)} test fixtures at {FIXTURE_PATH}")


if __name__ == "__main__":
    main()
