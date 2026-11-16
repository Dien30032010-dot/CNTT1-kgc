import type { ViolationRecord } from "../types";

export function toLocalDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalDateKey(dt);
}

export function isSundayDateKey(dateKey: string): boolean {
  return parseDateKey(dateKey).getDay() === 0;
}

export function getVietnameseWeekday(dateKey: string): string {
  const names = [
    "Chủ nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  return names[parseDateKey(dateKey).getDay()] || "";
}

export function toDefaultSchoolDateKey(d: Date = new Date()): string {
  const key = toLocalDateKey(d);
  return isSundayDateKey(key) ? shiftDateKey(key, -1) : key;
}

export function getSchoolWeekRange(refDateKey: string): {
  start: string;
  end: string;
} {
  const day = parseDateKey(refDateKey).getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = shiftDateKey(refDateKey, mondayOffset);
  const end = shiftDateKey(start, 5); // Thứ 2 -> Thứ 7
  return { start, end };
}

export function getSchoolMonthRange(refDateKey: string): {
  start: string;
  end: string;
  monthLabel: string;
} {
  const dt = parseDateKey(refDateKey);
  const year = dt.getFullYear();
  const month = dt.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    start: toLocalDateKey(firstDay),
    end: toLocalDateKey(lastDay),
    monthLabel: `Tháng ${String(month + 1).padStart(2, "0")}/${year}`,
  };
}

export function formatDateVi(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}

export function getRelativeDateLabel(
  dateKey: string,
  referenceDate: Date = new Date()
): string {
  const target = parseDateKey(dateKey);
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays === 2) return "Hôm kia";
  if (diffDays >= 3) return `${diffDays} ngày trước`;
  if (diffDays === -1) return "Ngày mai";
  return `Sau ${Math.abs(diffDays)} ngày`;
}

export function getViolationDateKey(v: ViolationRecord): string {
  if (v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
    return v.date;
  }
  const parsed = new Date(v.at);
  if (Number.isNaN(parsed.getTime())) {
    return toLocalDateKey();
  }
  return toLocalDateKey(parsed);
}
