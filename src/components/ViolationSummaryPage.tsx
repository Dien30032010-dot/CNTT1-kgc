import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ImageDown,
  Users,
} from "lucide-react";
import {
  formatDateVi,
  getRelativeDateLabel,
  getSchoolMonthRange,
  getSchoolWeekRange,
  getVietnameseWeekday,
  getViolationDateKey,
  isSundayDateKey,
  toDefaultSchoolDateKey,
} from "../lib/violationDates";
import { renderViolationsPrintImage } from "../lib/violationImageExport";
import type { ClassDatabase, SessionState } from "../types";

type SummaryPeriod = "day" | "week" | "month";

interface ViolationSummaryPageProps {
  db: ClassDatabase;
  session: SessionState;
  onToast: (msg: string) => void;
}

export function ViolationSummaryPage({
  db,
  session,
  onToast,
}: ViolationSummaryPageProps) {
  const defaultSchoolDay = toDefaultSchoolDateKey();
  const [period, setPeriod] = useState<SummaryPeriod>("day");
  const [refDate, setRefDate] = useState<string>(defaultSchoolDay);
  const [exporting, setExporting] = useState(false);

  const studentById = (id: string) => db.students.find((s) => s.id === id);
  const refIsSunday = isSundayDateKey(refDate || defaultSchoolDay);

  const range = useMemo(() => {
    const anchor = refDate || defaultSchoolDay;
    if (period === "day") {
      return {
        start: anchor,
        end: anchor,
        label: `Trong ngày ${getVietnameseWeekday(anchor)} (${formatDateVi(
          anchor
        )})`,
        shortRange: `${getVietnameseWeekday(anchor)}, ${formatDateVi(anchor)}`,
      };
    }
    if (period === "week") {
      const week = getSchoolWeekRange(anchor);
      return {
        start: week.start,
        end: week.end,
        label: `1 tuần (Thứ 2 – Thứ 7: ${formatDateVi(
          week.start
        )} – ${formatDateVi(week.end)})`,
        shortRange: `Thứ 2 – Thứ 7 (${formatDateVi(
          week.start
        )} – ${formatDateVi(week.end)})`,
      };
    }
    const month = getSchoolMonthRange(anchor);
    return {
      start: month.start,
      end: month.end,
      label: `1 tháng (${month.monthLabel} · Thứ 2 – Thứ 7)`,
      shortRange: `${month.monthLabel} (không tính Chủ nhật)`,
    };
  }, [period, refDate, defaultSchoolDay]);

  const filtered = useMemo(() => {
    return db.violations
      .map((v) => ({ record: v, dateKey: getViolationDateKey(v) }))
      .filter(
        ({ dateKey }) =>
          !isSundayDateKey(dateKey) &&
          dateKey >= range.start &&
          dateKey <= range.end
      )
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [db.violations, range.start, range.end]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const { record } of filtered) {
      map.set(record.type, (map.get(record.type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const byStudent = useMemo(() => {
    const map = new Map<
      string,
      { sid: string; count: number; items: string[] }
    >();
    for (const { record, dateKey } of filtered) {
      const existing = map.get(record.sid) || {
        sid: record.sid,
        count: 0,
        items: [],
      };
      existing.count += 1;
      existing.items.push(
        `${getRelativeDateLabel(dateKey)} (${formatDateVi(dateKey)}): ${
          record.type
        }${record.detail ? ` (${record.detail})` : ""}`
      );
      map.set(record.sid, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const handleExportSummaryImage = async () => {
    if (filtered.length === 0) {
      onToast("Không có vi phạm nào trong khoảng thời gian đã chọn.");
      return;
    }
    setExporting(true);
    try {
      const exporterName =
        session.role === "admin"
          ? "Quản lý lớp"
          : session.role === "teacher"
          ? session.currentTeacher || "Giáo viên"
          : session.currentOfficer || "Ban cán sự lớp";
      const periodHeading =
        period === "day"
          ? "TỔNG KẾT VI PHẠM TRONG NGÀY"
          : period === "week"
          ? "TỔNG KẾT VI PHẠM 1 TUẦN (THỨ 2 – THỨ 7)"
          : "TỔNG KẾT VI PHẠM 1 THÁNG (THỨ 2 – THỨ 7)";

      const rendered = await renderViolationsPrintImage({
        title: periodHeading,
        scopeLabel: range.label,
        exporterName,
        db,
        violations: filtered.map((x) => x.record),
      });

      const blobUrl = URL.createObjectURL(rendered.blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Tong-ket-vi-pham-${period}-${range.end}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      onToast("Đã xuất ảnh tổng kết vi phạm dạng in.");
    } catch {
      onToast("Không thể xuất ảnh tổng kết vi phạm.");
    } finally {
      setExporting(false);
    }
  };

  const cardClass =
    "bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 shadow-xs";
  const inputClass =
    "px-3 py-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

  const periods: { id: SummaryPeriod; label: string; hint: string }[] = [
    { id: "day", label: "Trong ngày", hint: "1 ngày" },
    { id: "week", label: "1 tuần", hint: "Thứ 2 – Thứ 7" },
    { id: "month", label: "1 tháng", hint: "Thứ 2 – Thứ 7" },
  ];

  const topType = byType[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Tổng kết vi phạm
          </h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {range.label} · Chỉ tính từ Thứ Hai đến Thứ Bảy
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportSummaryImage}
          disabled={exporting || filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImageDown className="w-4 h-4" />
          <span>{exporting ? "Đang xuất ảnh..." : "Xuất ảnh tổng kết"}</span>
        </button>
      </div>

      {/* Period & Date Controls */}
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {periods.map((item) => {
              const active = period === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--panel-subtle)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  {item.label}{" "}
                  <span
                    className={`text-xs ${
                      active ? "text-white/85" : "text-[var(--muted)]"
                    }`}
                  >
                    ({item.hint})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="summaryRefDate"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"
            >
              <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
              <span>Ngày mốc:</span>
            </label>
            <input
              id="summaryRefDate"
              type="date"
              value={refDate}
              onChange={(e) => setRefDate(e.target.value || defaultSchoolDay)}
              className={inputClass}
            />
            <span className="text-xs font-semibold text-[var(--muted)]">
              {getVietnameseWeekday(refDate || defaultSchoolDay)}
            </span>
            {refDate !== defaultSchoolDay && (
              <button
                type="button"
                onClick={() => setRefDate(defaultSchoolDay)}
                className="px-3 py-2 rounded-xl bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
              >
                Mới nhất
              </button>
            )}
          </div>
        </div>

        {period === "day" && refIsSunday && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/70 text-xs font-medium">
            Chủ nhật không có lịch học. Vui lòng chọn ngày từ Thứ Hai đến Thứ Bảy để xem tổng kết trong ngày.
          </div>
        )}
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            <AlertTriangle className="w-4 h-4 text-[var(--primary)]" />
            <span>Tổng lượt vi phạm</span>
          </div>
          <div className="text-3xl font-extrabold font-mono-num">
            {filtered.length}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            {range.shortRange}
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            <Users className="w-4 h-4 text-[var(--primary)]" />
            <span>Sinh viên vi phạm</span>
          </div>
          <div className="text-3xl font-extrabold font-mono-num">
            {byStudent.length}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1 tabular-nums">
            Trên tổng sĩ số {db.students.length} sinh viên
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
            <span>Lỗi nhiều nhất</span>
          </div>
          <div className="text-lg font-bold truncate">
            {topType ? topType.type : "Không có"}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1 tabular-nums">
            {topType ? `${topType.count} lượt trong kỳ` : "Chưa ghi nhận lỗi"}
          </div>
        </div>
      </div>

      {/* Breakdown by type & student */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">Theo loại vi phạm</h3>
          {byType.length > 0 ? (
            <div className="space-y-3">
              {byType.map((item) => {
                const pct =
                  filtered.length > 0
                    ? Math.round((item.count / filtered.length) * 100)
                    : 0;
                return (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="font-medium truncate">{item.type}</span>
                      <span className="font-mono-num font-bold shrink-0">
                        {item.count}{" "}
                        <span className="text-xs font-normal text-[var(--muted)]">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--panel-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)] py-6 text-center">
              Không có vi phạm nào trong kỳ.
            </p>
          )}
        </div>

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">
            Tổng hợp theo sinh viên ({byStudent.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3 w-12">STT</th>
                  <th className="py-2.5 px-3">Sinh viên</th>
                  <th className="py-2.5 px-3 w-24 text-center">Số lỗi</th>
                  <th className="py-2.5 px-3">Chi tiết trong kỳ</th>
                </tr>
              </thead>
              <tbody>
                {byStudent.length > 0 ? (
                  byStudent.map((item, idx) => {
                    const stu = studentById(item.sid);
                    return (
                      <tr
                        key={item.sid}
                        className="border-b border-[var(--line)] last:border-b-0"
                      >
                        <td className="py-2.5 px-3 tabular-nums text-[var(--muted)]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold">
                            {stu?.name || item.sid}
                          </div>
                          <div className="text-xs font-mono-num text-[var(--muted)]">
                            {item.sid}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                          {item.count}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-[var(--muted)] space-y-1">
                          {item.items.map((line, lIdx) => (
                            <div key={lIdx}>{line}</div>
                          ))}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Không có sinh viên nào vi phạm trong khoảng thời gian này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Chronological list for the selected period */}
      <div className={cardClass}>
        <h3 className="text-base font-bold mb-3">
          Chi tiết các lỗi trong kỳ ({filtered.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <th className="py-2.5 px-3">Ngày vi phạm</th>
                <th className="py-2.5 px-3">Sinh viên</th>
                <th className="py-2.5 px-3">Loại lỗi</th>
                <th className="py-2.5 px-3">Chi tiết</th>
                <th className="py-2.5 px-3">Người ghi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(({ record, dateKey }) => (
                  <tr
                    key={record.id}
                    className="border-b border-[var(--line)] last:border-b-0"
                  >
                    <td className="py-2.5 px-3 tabular-nums">
                      <div className="font-semibold text-[var(--ink)]">
                        {getRelativeDateLabel(dateKey)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {getVietnameseWeekday(dateKey)}, {formatDateVi(dateKey)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {studentById(record.sid)?.name || record.sid}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-red-600 dark:text-red-400">
                      {record.type}
                    </td>
                    <td className="py-2.5 px-3">{record.detail || "—"}</td>
                    <td className="py-2.5 px-3 text-[var(--muted)]">
                      {record.byName || "Quản lý"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-[var(--muted)]"
                  >
                    Không có dữ liệu vi phạm trong kỳ đã chọn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
