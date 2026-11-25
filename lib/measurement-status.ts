export type ChildMeasurementStatus = "Sudah Diukur" | "Belum Diukur";

export type MeasurementSegment = "all" | "measured" | "unmeasured";

export interface MeasurementPresenceInput {
  measurementCount?: number;
  latestMeasureDate?: string | null;
}

/**
 * Menentukan apakah profil anak sudah memiliki minimal satu data input pengukuran.
 */
export function hasChildMeasurement(input: MeasurementPresenceInput): boolean {
  if (typeof input.measurementCount === "number") {
    return input.measurementCount > 0;
  }
  return Boolean(input.latestMeasureDate);
}

/**
 * Mengembalikan label indikator status pengukuran anak:
 * - "Sudah Diukur" jika sudah ada minimal 1 data input pengukuran.
 * - "Belum Diukur" jika belum ada data input pengukuran sama sekali.
 */
export function getChildMeasurementStatus(
  input: number | MeasurementPresenceInput
): ChildMeasurementStatus {
  if (typeof input === "number") {
    return input > 0 ? "Sudah Diukur" : "Belum Diukur";
  }
  return hasChildMeasurement(input) ? "Sudah Diukur" : "Belum Diukur";
}

/**
 * Memfilter daftar anak berdasarkan segmen status pengukuran.
 */
export function filterChildrenByMeasurementSegment<
  T extends MeasurementPresenceInput,
>(items: T[], segment: MeasurementSegment): T[] {
  if (segment === "measured") {
    return items.filter((item) => hasChildMeasurement(item));
  }
  if (segment === "unmeasured") {
    return items.filter((item) => !hasChildMeasurement(item));
  }
  return items;
}
