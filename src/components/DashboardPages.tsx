import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  Download,
  Flag,
  GraduationCap,
  ImageDown,
  KeyRound,
  Mail,
  Palette,
  Pencil,
  PenLine,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import {
  CLASS_SUBJECTS,
  cloneDefaults,
  EVALUATION_LEVELS,
  normalizeDatabase,
  VIOLATION_TYPES,
} from "../data/defaults";
import {
  exportAndAutoImportFromServer,
  triggerJsonFileDownload,
} from "../lib/serverSync";
import {
  formatDateVi,
  getRelativeDateLabel,
  getVietnameseWeekday,
  getViolationDateKey,
  isSundayDateKey,
  toDefaultSchoolDateKey,
} from "../lib/violationDates";
import { renderViolationsPrintImage } from "../lib/violationImageExport";
import type {
  Announcement,
  ClassDatabase,
  EditRequest,
  EvaluationRecord,
  FundRecord,
  GradeRecord,
  PageId,
  Role,
  SessionState,
  ThemeMode,
  ViolationRecord,
} from "../types";
import type { ModalConfig } from "./ModalDialog";
import { ViolationSummaryPage } from "./ViolationSummaryPage";

interface DashboardPagesProps {
  page: PageId;
  db: ClassDatabase;
  session: SessionState;
  onNavigate: (p: PageId) => void;
  onUpdateDb: (updater: (prev: ClassDatabase) => ClassDatabase) => void;
  onToast: (msg: string) => void;
  onOpenModal: (modal: ModalConfig) => void;
  onImportFromServer: () => Promise<void>;
  importingFromServer: boolean;
  onSendToServer: () => Promise<void>;
  sendingToServer: boolean;
}

function roleText(role: string): string {
  switch (role) {
    case "student":
      return "Sinh viên";
    case "teacher":
      return "Giáo viên";
    case "admin":
      return "Quản lý";
    case "officer":
      return "Ban cán sự lớp";
    default:
      return role;
  }
}

function requestKindLabel(kind: EditRequest["kind"]): string {
  switch (kind) {
    case "grade":
      return "Điểm số";
    case "evaluation":
      return "Đánh giá";
    case "violation":
      return "Vi phạm";
  }
}

export function isTreasurerSession(session: SessionState): boolean {
  if (session.role !== "officer") return false;
  const pos = session.currentOfficerPosition.trim().toLowerCase();
  return pos.includes("quỹ") || pos.includes("quỷ");
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

export function DashboardPages({
  page,
  db,
  session,
  onNavigate,
  onUpdateDb,
  onToast,
  onOpenModal,
  onImportFromServer,
  importingFromServer,
  onSendToServer,
  sendingToServer,
}: DashboardPagesProps) {
  const isAdmin = session.role === "admin";
  const isTreasurer = isTreasurerSession(session);
  const canManageFund = isAdmin || isTreasurer;
  const studentById = (id: string) => db.students.find((s) => s.id === id);

  // Search states
  const [memberQuery, setMemberQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [myGradeQuery, setMyGradeQuery] = useState("");
  const [myGradeTermFilter, setMyGradeTermFilter] = useState("all");

  // Student add form
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");

  // Grade add form
  const [gradeSid, setGradeSid] = useState(db.students[0]?.id ?? "");
  const [gradeSubjectChoice, setGradeSubjectChoice] = useState<string>(() => {
    const teacherSubj = session.currentTeacherSubject.trim();
    if (!teacherSubj) return CLASS_SUBJECTS[0];
    const matched = CLASS_SUBJECTS.find(
      (s) => s.toLowerCase() === teacherSubj.toLowerCase()
    );
    return matched ?? "__custom__";
  });
  const [gradeSubject, setGradeSubject] = useState(
    session.currentTeacherSubject || ""
  );
  const [gradeValue, setGradeValue] = useState("");
  const [gradeTerm, setGradeTerm] = useState("");
  const [gradeNote, setGradeNote] = useState("");

  // Evaluation add form
  const [evalSid, setEvalSid] = useState(db.students[0]?.id ?? "");
  const [evalLevel, setEvalLevel] = useState<string>(EVALUATION_LEVELS[0]);
  const [evalNote, setEvalNote] = useState("");

  // Violation add form & print-image export state
  const [vioSid, setVioSid] = useState(db.students[0]?.id ?? "");
  const [vioType, setVioType] = useState<string>(VIOLATION_TYPES[0]);
  const [vioDate, setVioDate] = useState(() => toDefaultSchoolDateKey());
  const [lateMinutes, setLateMinutes] = useState("");
  const [vioSubjectChoice, setVioSubjectChoice] = useState<string>(
    CLASS_SUBJECTS[0]
  );
  const [vioCustomSubject, setVioCustomSubject] = useState("");
  const [vioNote, setVioNote] = useState("");
  const [vioExportScope, setVioExportScope] = useState("all");
  const [vioExportTitle, setVioExportTitle] = useState(
    "BẢNG TỔNG HỢP LỖI VI PHẠM"
  );
  const [vioExportPreview, setVioExportPreview] = useState("");
  const [vioExportDims, setVioExportDims] = useState("");
  const [vioExportBusy, setVioExportBusy] = useState(false);

  // Teacher add form
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");

  // Officer add form
  const [officerTarget, setOfficerTarget] = useState(db.students[0]?.name ?? "__custom__");
  const [officerCustomName, setOfficerCustomName] = useState("");
  const [officerPosition, setOfficerPosition] = useState("");

  // Announcement add form
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");

  // Fund / Expense add & filter state
  const [fundKind, setFundKind] = useState<"expense" | "income">("expense");
  const [fundTitle, setFundTitle] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundDate, setFundDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [fundNote, setFundNote] = useState("");
  const [fundQuery, setFundQuery] = useState("");
  const [fundFilter, setFundFilter] = useState<"all" | "income" | "expense">(
    "all"
  );

  // Settings form
  const [classNameInput, setClassNameInput] = useState(db.className);
  const [schoolInput, setSchoolInput] = useState(db.school);
  const [newTeacherPass, setNewTeacherPass] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [newOfficerPass, setNewOfficerPass] = useState("");

  useEffect(() => {
    setClassNameInput(db.className);
    setSchoolInput(db.school);
  }, [db.className, db.school]);

  const effectiveGradeSid =
    db.students.some((s) => s.id === gradeSid) ? gradeSid : db.students[0]?.id ?? "";
  const effectiveEvalSid =
    db.students.some((s) => s.id === evalSid) ? evalSid : db.students[0]?.id ?? "";
  const effectiveVioSid =
    db.students.some((s) => s.id === vioSid) ? vioSid : db.students[0]?.id ?? "";

  const requestEdit = (kind: EditRequest["kind"], recordId: string) => {
    onOpenModal({
      type: "input",
      title: "Gửi yêu cầu chỉnh sửa",
      label: "Mô tả nội dung cần quản lý chỉnh sửa",
      initialValue: "",
      inputType: "textarea",
      placeholder: "Ghi rõ thông tin bị sai và giá trị cần sửa...",
      confirmLabel: "Gửi yêu cầu",
      onSubmit: (reason) => {
        const trimmed = reason.trim();
        if (!trimmed) {
          onToast("Vui lòng nhập nội dung yêu cầu.");
          return false;
        }
        onUpdateDb((prev) => ({
          ...prev,
          requests: [
            ...prev.requests,
            {
              id: crypto.randomUUID(),
              kind,
              recordId,
              reason: trimmed,
              from: session.role,
              fromName:
                session.role === "teacher"
                  ? session.currentTeacher
                  : session.role === "officer"
                  ? session.currentOfficer
                  : undefined,
              at: new Date().toISOString(),
              status: "Chờ xử lý",
            },
          ],
        }));
        onToast("Đã gửi yêu cầu đến quản lý.");
      },
    });
  };

  const deleteRecord = (
    kind: "grades" | "evaluations" | "violations",
    id: string
  ) => {
    onOpenModal({
      type: "confirm",
      title: "Xóa bản ghi",
      message: "Bạn chắc chắn muốn xóa bản ghi này? Hành động này không thể hoàn tác.",
      confirmLabel: "Xóa",
      danger: true,
      onConfirm: () => {
        onUpdateDb((prev) => ({
          ...prev,
          [kind]: prev[kind].filter((item) => item.id !== id),
          deletedIds: [...(prev.deletedIds ?? []), id].slice(-500),
        }));
        onToast("Đã xóa bản ghi.");
      },
    });
  };

  const editGrade = (g: GradeRecord) => {
    onOpenModal({
      type: "input",
      title: "Chỉnh sửa điểm",
      label: `Nhập điểm mới cho ${studentById(g.sid)?.name || g.sid} (${g.subject})`,
      initialValue: String(g.value),
      inputType: "number",
      min: 0,
      max: 10,
      step: "0.1",
      confirmLabel: "Lưu điểm",
      onSubmit: (val) => {
        const num = Number(val);
        if (val.trim() === "" || !Number.isFinite(num) || num < 0 || num > 10) {
          onToast("Điểm không hợp lệ (từ 0 đến 10).");
          return false;
        }
        onUpdateDb((prev) => ({
          ...prev,
          grades: prev.grades.map((x) =>
            x.id === g.id ? { ...x, value: num } : x
          ),
        }));
        onToast("Đã cập nhật điểm.");
      },
    });
  };

  const editEvaluation = (e: EvaluationRecord) => {
    onOpenModal({
      type: "input",
      title: "Chỉnh sửa đánh giá",
      label: `Nội dung đánh giá (${studentById(e.sid)?.name || e.sid})`,
      initialValue: e.note,
      inputType: "textarea",
      confirmLabel: "Lưu đánh giá",
      onSubmit: (note) => {
        onUpdateDb((prev) => ({
          ...prev,
          evaluations: prev.evaluations.map((x) =>
            x.id === e.id ? { ...x, note: note.trim() } : x
          ),
        }));
        onToast("Đã cập nhật đánh giá.");
      },
    });
  };

  const editViolation = (v: ViolationRecord) => {
    onOpenModal({
      type: "input",
      title: "Chỉnh sửa chi tiết vi phạm",
      label: `Chi tiết vi phạm (${studentById(v.sid)?.name || v.sid})`,
      initialValue: v.detail,
      inputType: "textarea",
      confirmLabel: "Lưu vi phạm",
      onSubmit: (detail) => {
        onUpdateDb((prev) => ({
          ...prev,
          violations: prev.violations.map((x) =>
            x.id === v.id ? { ...x, detail: detail.trim() } : x
          ),
        }));
        onToast("Đã cập nhật vi phạm.");
      },
    });
  };

  const editAnnouncement = (a: Announcement) => {
    onOpenModal({
      type: "input",
      title: "Chỉnh sửa thông báo",
      label: `Nội dung thông báo (${a.title})`,
      initialValue: a.content,
      inputType: "textarea",
      confirmLabel: "Lưu thông báo",
      onSubmit: (content) => {
        const trimmed = content.trim();
        if (!trimmed) {
          onToast("Nội dung thông báo không được để trống.");
          return false;
        }
        onUpdateDb((prev) => ({
          ...prev,
          announcements: prev.announcements.map((x) =>
            x.id === a.id ? { ...x, content: trimmed } : x
          ),
        }));
        onToast("Đã cập nhật thông báo.");
      },
    });
  };

  const deleteAnnouncement = (id: string) => {
    onOpenModal({
      type: "confirm",
      title: "Xóa thông báo",
      message: "Bạn chắc chắn muốn xóa thông báo này?",
      confirmLabel: "Xóa",
      danger: true,
      onConfirm: () => {
        onUpdateDb((prev) => ({
          ...prev,
          announcements: prev.announcements.filter((x) => x.id !== id),
          deletedIds: [...(prev.deletedIds ?? []), id].slice(-500),
        }));
        onToast("Đã xóa thông báo.");
      },
    });
  };

  const sortedAnnouncements = [...db.announcements].sort((a, b) =>
    b.at.localeCompare(a.at)
  );

  const cardClass =
    "bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5 shadow-xs";
  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const btnPrimary =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap";
  const btnSecondary =
    "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] hover:opacity-90 text-xs font-semibold transition-opacity cursor-pointer whitespace-nowrap";
  const btnDanger =
    "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e34d5b] hover:bg-[#c83c49] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap";
  const noticeClass =
    "p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/70 text-sm";

  // 1. HOME PAGE
  if (page === "home") {
    if (session.role === "student") {
      const me = studentById(session.currentStudent);
      const myGrades = db.grades.filter((g) => g.sid === session.currentStudent);
      const myAvg =
        myGrades.length > 0
          ? (
              myGrades.reduce((sum, g) => sum + g.value, 0) / myGrades.length
            ).toFixed(2)
          : "—";

      return (
        <div className="space-y-5">
          <div className="rounded-2xl p-6 text-white bg-gradient-to-r from-[#1359c2] to-[#2486f4]">
            <h2 className="text-2xl font-bold tracking-tight">
              Xin chào, {me?.name || "Sinh viên"}!
            </h2>
            <p className="text-white/90 text-sm mt-1">
              Chào mừng bạn đến với hệ thống quản lý lớp {db.className}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-3">Thông tin của bạn</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 py-1 border-b border-[var(--line)]">
                  <dt className="text-[var(--muted)]">Họ và tên</dt>
                  <dd className="font-semibold">{me?.name}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-[var(--line)]">
                  <dt className="text-[var(--muted)]">Mã sinh viên</dt>
                  <dd className="font-mono-num font-semibold">{me?.id}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-[var(--muted)]">Điểm trung bình</dt>
                  <dd className="font-mono-num font-bold text-[var(--primary)]">
                    {myAvg}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={cardClass}>
              <h3 className="text-base font-bold mb-3">Thông tin lớp</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 py-1 border-b border-[var(--line)]">
                  <dt className="text-[var(--muted)]">Lớp</dt>
                  <dd className="font-semibold">{db.className}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-[var(--line)]">
                  <dt className="text-[var(--muted)]">Trường</dt>
                  <dd className="font-semibold text-right">{db.school}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-[var(--muted)]">Sĩ số</dt>
                  <dd className="tabular-nums font-semibold">
                    {db.students.length} sinh viên
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-base font-bold">
                  Bảng điểm cá nhân ({myGrades.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("myGrades")}
                className={btnSecondary}
              >
                Xem chi tiết
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <th className="py-2 px-3">Môn học</th>
                    <th className="py-2 px-3">Điểm số</th>
                    <th className="py-2 px-3">Học kỳ / đợt</th>
                  </tr>
                </thead>
                <tbody>
                  {myGrades.length > 0 ? (
                    myGrades.slice(0, 5).map((g) => (
                      <tr
                        key={g.id}
                        className="border-b border-[var(--line)] last:border-b-0"
                      >
                        <td className="py-2 px-3 font-medium">{g.subject}</td>
                        <td className="py-2 px-3 font-mono-num font-bold">
                          {g.value}
                        </td>
                        <td className="py-2 px-3 text-[var(--muted)]">
                          {g.term || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-[var(--muted)]"
                      >
                        Chưa có điểm được cập nhật
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-base font-bold">Thông báo lớp học</h3>
              </div>
              {sortedAnnouncements.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("announcements")}
                  className={btnSecondary}
                >
                  Xem tất cả ({sortedAnnouncements.length})
                </button>
              )}
            </div>

            {sortedAnnouncements.length > 0 ? (
              <div className="divide-y divide-[var(--line)]">
                {sortedAnnouncements.slice(0, 5).map((a) => (
                  <article key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <h4 className="font-bold text-sm">{a.title}</h4>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      {a.authorName} · {roleText(a.authorRole)}
                      {a.authorDetail ? ` (${a.authorDetail})` : ""} ·{" "}
                      <span className="tabular-nums">
                        {new Date(a.at).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-sm mt-1.5 whitespace-pre-line">
                      {a.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Chưa có thông báo mới từ quản lý, giáo viên hoặc ban cán sự.
              </p>
            )}

            <p className="text-xs text-[var(--muted)] mt-4 pt-3 border-t border-[var(--line)]">
              Tài khoản sinh viên chỉ được xem họ tên, mã số sinh viên của lớp, bảng điểm, vi phạm cá nhân và thông báo lớp học.
            </p>
          </div>
        </div>
      );
    }

    const greetingName =
      session.role === "teacher"
        ? session.currentTeacher
        : session.role === "officer"
        ? session.currentOfficer
        : roleText(session.role);

    return (
      <div className="space-y-5">
        <div className="rounded-2xl p-6 text-white bg-gradient-to-r from-[#1359c2] to-[#2486f4]">
          <h2 className="text-2xl font-bold tracking-tight">
            Hệ thống quản lý lớp {db.className}
          </h2>
          <p className="text-white/90 text-sm mt-1">
            {db.school} · Xin chào {greetingName}
            {session.role === "teacher" && session.currentTeacherSubject
              ? ` (${session.currentTeacherSubject})`
              : session.role === "officer" && session.currentOfficerPosition
              ? ` (${session.currentOfficerPosition})`
              : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl p-5 text-white bg-[#2474e9] flex flex-col justify-between min-h-[116px]">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <Users className="w-4 h-4" />
              <span>Sinh viên</span>
            </div>
            <div className="text-3xl font-extrabold tabular-nums">
              {db.students.length}
            </div>
          </div>
          <div className="rounded-2xl p-5 text-white bg-[#17a36b] flex flex-col justify-between min-h-[116px]">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <PenLine className="w-4 h-4" />
              <span>Bản ghi điểm</span>
            </div>
            <div className="text-3xl font-extrabold tabular-nums">
              {db.grades.length}
            </div>
          </div>
          <div className="rounded-2xl p-5 text-white bg-[#7554d9] flex flex-col justify-between min-h-[116px]">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <Star className="w-4 h-4" />
              <span>Đánh giá</span>
            </div>
            <div className="text-3xl font-extrabold tabular-nums">
              {db.evaluations.length}
            </div>
          </div>
          <div className="rounded-2xl p-5 text-white bg-[#ed941e] flex flex-col justify-between min-h-[116px]">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <Flag className="w-4 h-4" />
              <span>Vi phạm</span>
            </div>
            <div className="text-3xl font-extrabold tabular-nums">
              {db.violations.length}
            </div>
          </div>
        </div>

        {session.role === "admin" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-3">Sinh viên</h3>
              <button
                type="button"
                onClick={() => onNavigate("students")}
                className={btnPrimary}
              >
                Thêm / xóa sinh viên
              </button>
            </div>
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-3">Điểm số</h3>
              <button
                type="button"
                onClick={() => onNavigate("grades")}
                className={btnPrimary}
              >
                Nhập và quản lý điểm
              </button>
            </div>
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-3">Vi phạm</h3>
              <button
                type="button"
                onClick={() => onNavigate("violations")}
                className={btnPrimary}
              >
                Ghi lỗi vi phạm
              </button>
            </div>
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-3">Cài đặt</h3>
              <button
                type="button"
                onClick={() => onNavigate("settings")}
                className={btnPrimary}
              >
                Tùy chỉnh hệ thống
              </button>
            </div>
          </div>
        )}

        {session.role === "teacher" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-1.5">Nhập điểm</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Bản ghi sau khi lưu sẽ bị khóa chỉnh sửa.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("grades")}
                className={btnPrimary}
              >
                Mở nhập điểm
              </button>
            </div>
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-1.5">Đánh giá sinh viên</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Đánh giá học tập và thái độ rèn luyện.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("evaluations")}
                className={btnPrimary}
              >
                Mở đánh giá
              </button>
            </div>
          </div>
        )}

        {session.role === "officer" && (
          <div
            className={
              isTreasurer
                ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                : "grid grid-cols-1 gap-4"
            }
          >
            <div className={cardClass}>
              <h3 className="text-base font-bold mb-1.5">Ghi nhận vi phạm</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Sau khi lưu, ban cán sự không thể tự sửa hoặc xóa bản ghi.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("violations")}
                className={btnPrimary}
              >
                Ghi lỗi vi phạm
              </button>
            </div>
            {isTreasurer && (
              <div className={cardClass}>
                <h3 className="text-base font-bold mb-1.5">
                  Quỹ & chi tiêu lớp
                </h3>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Ghi chép các khoản thu, chi tiêu của lớp; giáo viên và quản lý đều theo dõi được.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate("fund")}
                  className={btnPrimary}
                >
                  Mở quản lý chi tiêu
                </button>
              </div>
            )}
          </div>
        )}

        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-base font-bold">
                Thông báo lớp học ({sortedAnnouncements.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("announcements")}
              className={btnSecondary}
            >
              Ghi thông báo mới
            </button>
          </div>

          {sortedAnnouncements.length > 0 ? (
            <div className="divide-y divide-[var(--line)]">
              {sortedAnnouncements.slice(0, 5).map((a) => (
                <article key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm">{a.title}</h4>
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        {a.authorName} · {roleText(a.authorRole)}
                        {a.authorDetail ? ` (${a.authorDetail})` : ""} ·{" "}
                        <span className="tabular-nums">
                          {new Date(a.at).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm mt-1.5 whitespace-pre-line">
                    {a.content}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Chưa có thông báo nào. Quản lý, giáo viên và ban cán sự có thể đăng thông báo mới tại mục Thông báo.
            </p>
          )}
        </div>

        <div className={noticeClass}>
          Lưu ý:{" "}
          {session.role === "teacher"
            ? "Giáo viên không thể tự sửa điểm hoặc đánh giá đã lưu."
            : session.role === "officer"
            ? "Ban cán sự không thể tự sửa vi phạm đã lưu."
            : "Quản lý có quyền xử lý các yêu cầu chỉnh sửa và quản trị dữ liệu."}
        </div>
      </div>
    );
  }

  // 1B. ANNOUNCEMENTS PAGE
  if (page === "announcements") {
    const canPost =
      session.role === "admin" ||
      session.role === "teacher" ||
      session.role === "officer";

    const handleAddAnnouncement = (e: React.FormEvent) => {
      e.preventDefault();
      const content = announcementContent.trim();
      const title = announcementTitle.trim() || "Thông báo lớp";
      if (!content) {
        onToast("Vui lòng nhập nội dung thông báo.");
        return;
      }

      const authorName =
        session.role === "teacher"
          ? session.currentTeacher || "Giáo viên"
          : session.role === "officer"
          ? session.currentOfficer || "Ban cán sự lớp"
          : "Quản lý";
      const authorDetail =
        session.role === "teacher"
          ? session.currentTeacherSubject || undefined
          : session.role === "officer"
          ? session.currentOfficerPosition || undefined
          : undefined;

      onUpdateDb((prev) => ({
        ...prev,
        announcements: [
          {
            id: crypto.randomUUID(),
            title,
            content,
            authorName,
            authorRole: session.role,
            authorDetail,
            at: new Date().toISOString(),
          },
          ...prev.announcements,
        ],
      }));
      setAnnouncementTitle("");
      setAnnouncementContent("");
      onToast("Đã đăng thông báo mới.");
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">Thông báo lớp học</h2>

        {canPost && (
          <form onSubmit={handleAddAnnouncement} className={cardClass}>
            <h3 className="text-base font-bold mb-3">Ghi thông báo mới</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">
                  Tiêu đề thông báo
                </label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="VD: Lịch học bù, Thu quỹ lớp, Nhắc nhở..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">
                  Nội dung thông báo
                </label>
                <textarea
                  rows={3}
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="Nhập nội dung cần thông báo đến sinh viên, ban cán sự và giáo viên..."
                  className={inputClass}
                />
              </div>
            </div>
            <button type="submit" className={btnPrimary}>
              <Plus className="w-4 h-4" />
              <span>Đăng thông báo</span>
            </button>
          </form>
        )}

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">
            Danh sách thông báo ({sortedAnnouncements.length})
          </h3>
          {sortedAnnouncements.length > 0 ? (
            <div className="divide-y divide-[var(--line)]">
              {sortedAnnouncements.map((a) => (
                <article key={a.id} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-base">{a.title}</h4>
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        {a.authorName} · {roleText(a.authorRole)}
                        {a.authorDetail ? ` (${a.authorDetail})` : ""} ·{" "}
                        <span className="tabular-nums">
                          {new Date(a.at).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => editAnnouncement(a)}
                          className={btnSecondary}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAnnouncement(a.id)}
                          className={btnDanger}
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-line leading-relaxed">
                    {a.content}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              Chưa có thông báo nào được đăng.
            </p>
          )}
        </div>
      </div>
    );
  }

  // 2. MEMBERS PAGE
  if (page === "members") {
    const q = memberQuery.trim().toLowerCase();
    const filtered = db.students.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );

    if (session.role === "student") {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Danh sách thành viên lớp
          </h2>
          <div className={cardClass}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <th className="py-2.5 px-3">Họ và tên</th>
                    <th className="py-2.5 px-3">Mã sinh viên</th>
                  </tr>
                </thead>
                <tbody>
                  {db.students.length > 0 ? (
                    db.students.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--panel-subtle)]/60"
                      >
                        <td className="py-2.5 px-3 font-medium">
                          {s.name}
                          {s.id === session.currentStudent && (
                            <span className="ml-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              · Bạn
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-[var(--muted)]">
                          {s.id}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-8 text-center text-[var(--muted)]"
                      >
                        Chưa có dữ liệu
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

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Danh sách thành viên lớp
        </h2>
        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="text-sm font-bold tabular-nums">
              {filtered.length} / {db.students.length} sinh viên
            </span>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Tìm tên hoặc mã sinh viên..."
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3 w-16">STT</th>
                  <th className="py-2.5 px-3">Họ và tên</th>
                  <th className="py-2.5 px-3">Mã sinh viên</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((s, idx) => (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--panel-subtle)]/60"
                    >
                      <td className="py-2.5 px-3 tabular-nums text-[var(--muted)]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium">{s.name}</td>
                      <td className="py-2.5 px-3 font-mono-num text-[var(--muted)]">
                        {s.id}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Không tìm thấy sinh viên phù hợp
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

  // 3. STUDENT MY GRADES
  if (page === "myGrades") {
    const me = studentById(session.currentStudent);
    const allMyGrades = db.grades.filter((g) => g.sid === session.currentStudent);
    const terms = Array.from(
      new Set(allMyGrades.map((g) => g.term.trim()).filter(Boolean))
    );
    const q = myGradeQuery.trim().toLowerCase();
    const rows = allMyGrades.filter((g) => {
      const matchQuery = !q || g.subject.toLowerCase().includes(q);
      const matchTerm =
        myGradeTermFilter === "all" || g.term.trim() === myGradeTermFilter;
      return matchQuery && matchTerm;
    });

    const avgScore =
      rows.length > 0
        ? (rows.reduce((sum, g) => sum + g.value, 0) / rows.length).toFixed(2)
        : "—";
    const highestScore =
      rows.length > 0
        ? Math.max(...rows.map((g) => g.value)).toFixed(1)
        : "—";

    const scoreStatus = (val: number) => {
      if (val >= 8) {
        return {
          label: "Giỏi",
          cls: "text-emerald-700 dark:text-emerald-400",
        };
      }
      if (val >= 6.5) {
        return {
          label: "Khá",
          cls: "text-[var(--primary)]",
        };
      }
      if (val >= 5) {
        return {
          label: "Đạt",
          cls: "text-amber-700 dark:text-amber-400",
        };
      }
      return {
        label: "Cần cố gắng",
        cls: "text-red-600 dark:text-red-400",
      };
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Bảng điểm cá nhân
          </h2>
          {me && (
            <span className="text-xs text-[var(--muted)] font-mono-num">
              {me.name} · {me.id}
            </span>
          )}
        </div>

        <div className={noticeClass}>
          Đây là trang chỉ xem. Bạn không thể thêm, sửa hoặc xóa điểm.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={cardClass}>
            <div className="text-xs font-medium text-[var(--muted)]">
              Số môn / đầu điểm
            </div>
            <div className="text-2xl font-extrabold font-mono-num mt-1">
              {rows.length}
            </div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-medium text-[var(--muted)]">
              Điểm trung bình
            </div>
            <div className="text-2xl font-extrabold font-mono-num mt-1 text-[var(--primary)]">
              {avgScore}
            </div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-medium text-[var(--muted)]">
              Điểm cao nhất
            </div>
            <div className="text-2xl font-extrabold font-mono-num mt-1 text-emerald-600 dark:text-emerald-400">
              {highestScore}
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={myGradeQuery}
                onChange={(e) => setMyGradeQuery(e.target.value)}
                placeholder="Tìm theo tên môn học..."
                className={`${inputClass} pl-9`}
              />
            </div>

            {terms.length > 0 && (
              <select
                value={myGradeTermFilter}
                onChange={(e) => setMyGradeTermFilter(e.target.value)}
                aria-label="Lọc theo học kỳ"
                className="w-full sm:w-52 px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="all">Tất cả học kỳ</option>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[580px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3 w-14">STT</th>
                  <th className="py-2.5 px-3">Môn học</th>
                  <th className="py-2.5 px-3">Điểm số</th>
                  <th className="py-2.5 px-3">Xếp loại</th>
                  <th className="py-2.5 px-3">Học kỳ / đợt</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((g, idx) => {
                    const st = scoreStatus(g.value);
                    return (
                      <tr
                        key={g.id}
                        className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--panel-subtle)]/60"
                      >
                        <td className="py-2.5 px-3 tabular-nums text-[var(--muted)]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{g.subject}</div>
                          {g.byName && (
                            <div className="text-xs text-[var(--muted)]">
                              GV: {g.byName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-base">
                          {g.value}
                        </td>
                        <td className={`py-2.5 px-3 font-semibold ${st.cls}`}>
                          {st.label}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--muted)]">
                          {g.term || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--muted)]">
                          {g.note || "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      {allMyGrades.length > 0
                        ? "Không tìm thấy môn học phù hợp"
                        : "Chưa có điểm được cập nhật"}
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

  // 4. STUDENT MY VIOLATIONS
  if (page === "myViolations") {
    const rows = db.violations.filter((v) => v.sid === session.currentStudent);
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Vi phạm của tôi</h2>
        <div className={noticeClass}>
          Đây là trang chỉ xem. Bạn không thể thêm, sửa hoặc xóa thông tin vi phạm.
        </div>
        <div className={cardClass}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Loại vi phạm</th>
                  <th className="py-2.5 px-3">Chi tiết</th>
                  <th className="py-2.5 px-3">Ngày vi phạm</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((v) => {
                    const dateKey = getViolationDateKey(v);
                    return (
                      <tr
                        key={v.id}
                        className="border-b border-[var(--line)] last:border-b-0"
                      >
                        <td className="py-2.5 px-3 font-semibold text-red-600 dark:text-red-400">
                          {v.type}
                        </td>
                        <td className="py-2.5 px-3">{v.detail || "—"}</td>
                        <td className="py-2.5 px-3 tabular-nums">
                          <div className="font-semibold text-[var(--ink)]">
                            {getRelativeDateLabel(dateKey)}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {formatDateVi(dateKey)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa có lỗi vi phạm được ghi nhận
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

  // 5. ADMIN STUDENTS MANAGEMENT
  if (page === "students") {
    const q = studentQuery.trim().toLowerCase();
    const filtered = db.students.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );

    const handleAddStudent = (e: React.FormEvent) => {
      e.preventDefault();
      const name = newStudentName.trim();
      const id = newStudentId.trim();
      if (!name || !id) {
        onToast("Vui lòng nhập đủ họ tên và mã sinh viên.");
        return;
      }
      if (db.students.some((s) => s.id === id)) {
        onToast("Mã sinh viên đã tồn tại.");
        return;
      }
      onUpdateDb((prev) => ({
        ...prev,
        students: [...prev.students, { name, id }],
      }));
      setNewStudentName("");
      setNewStudentId("");
      onToast("Đã thêm sinh viên.");
    };

    const handleDeleteStudent = (id: string, name: string) => {
      onOpenModal({
        type: "confirm",
        title: "Xóa sinh viên",
        message: `Xóa sinh viên ${name} (${id})? Các bản ghi điểm, đánh giá và vi phạm cũ sẽ được giữ nguyên.`,
        confirmLabel: "Xóa",
        danger: true,
        onConfirm: () => {
          onUpdateDb((prev) => ({
            ...prev,
            students: prev.students.filter((s) => s.id !== id),
          }));
          onToast("Đã xóa sinh viên khỏi danh sách.");
        },
      });
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">Quản lý sinh viên</h2>

        <form onSubmit={handleAddStudent} className={cardClass}>
          <h3 className="text-base font-bold mb-3">Thêm sinh viên</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Họ và tên
              </label>
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Mã số sinh viên
              </label>
              <input
                type="text"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="VD: IT26CN3199"
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className={btnPrimary}>
            <Plus className="w-4 h-4" />
            <span>Thêm sinh viên</span>
          </button>
        </form>

        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-bold tabular-nums">
              Danh sách sinh viên ({db.students.length})
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Tìm kiếm..."
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Họ tên</th>
                  <th className="py-2.5 px-3">Mã sinh viên</th>
                  <th className="py-2.5 px-3 w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--panel-subtle)]/60"
                    >
                      <td className="py-2.5 px-3 font-medium">{s.name}</td>
                      <td className="py-2.5 px-3 font-mono-num text-[var(--muted)]">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(s.id, s.name)}
                          className={btnDanger}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa có dữ liệu
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

  // 6. GRADES PAGE
  if (page === "grades") {
    const handleAddGrade = (e: React.FormEvent) => {
      e.preventDefault();
      const subject =
        gradeSubjectChoice === "__custom__"
          ? gradeSubject.trim()
          : gradeSubjectChoice;
      const num = Number(gradeValue);
      if (
        !effectiveGradeSid ||
        !subject ||
        gradeValue.trim() === "" ||
        !Number.isFinite(num) ||
        num < 0 ||
        num > 10
      ) {
        onToast("Kiểm tra sinh viên, môn học và điểm từ 0 đến 10.");
        return;
      }
      onUpdateDb((prev) => ({
        ...prev,
        grades: [
          ...prev.grades,
          {
            id: crypto.randomUUID(),
            sid: effectiveGradeSid,
            subject,
            value: num,
            term: gradeTerm.trim(),
            note: gradeNote.trim(),
            by: session.role,
            byName:
              session.role === "teacher" ? session.currentTeacher : undefined,
            at: new Date().toISOString(),
          },
        ],
      }));
      setGradeValue("");
      setGradeNote("");
      onToast("Đã lưu điểm. Bản ghi đã khóa.");
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "Quản lý điểm" : "Nhập điểm sinh viên"}
        </h2>

        {!isAdmin && (
          <div className={noticeClass}>
            Sau khi lưu, giáo viên không thể chỉnh sửa hoặc xóa bản ghi. Nếu nhập sai, hãy gửi yêu cầu quản lý.
          </div>
        )}

        <form onSubmit={handleAddGrade} className={cardClass}>
          <h3 className="text-base font-bold mb-3">
            {isAdmin ? "Thêm / chỉnh sửa điểm" : "Nhập điểm mới"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Sinh viên
              </label>
              <select
                value={effectiveGradeSid}
                onChange={(e) => setGradeSid(e.target.value)}
                className={inputClass}
              >
                {db.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Môn học
              </label>
              <select
                value={gradeSubjectChoice}
                onChange={(e) => setGradeSubjectChoice(e.target.value)}
                className={inputClass}
              >
                {CLASS_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
                <option value="__custom__">+ Nhập môn học khác...</option>
              </select>
              {gradeSubjectChoice === "__custom__" && (
                <input
                  type="text"
                  value={gradeSubject}
                  onChange={(e) => setGradeSubject(e.target.value)}
                  placeholder="Nhập tên môn học"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Điểm
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step="0.1"
                value={gradeValue}
                onChange={(e) => setGradeValue(e.target.value)}
                placeholder="0 - 10"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Học kỳ / đợt
              </label>
              <input
                type="text"
                value={gradeTerm}
                onChange={(e) => setGradeTerm(e.target.value)}
                placeholder="VD: Học kỳ I"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1.5">
              Ghi chú
            </label>
            <textarea
              rows={2}
              value={gradeNote}
              onChange={(e) => setGradeNote(e.target.value)}
              placeholder="Nhận xét thêm (không bắt buộc)"
              className={inputClass}
            />
          </div>

          <button type="submit" className={btnPrimary}>
            Lưu điểm
          </button>
        </form>

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">Bảng điểm</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Sinh viên</th>
                  <th className="py-2.5 px-3">Môn học</th>
                  <th className="py-2.5 px-3">Điểm</th>
                  <th className="py-2.5 px-3">Học kỳ</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                  <th className="py-2.5 px-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {db.grades.length > 0 ? (
                  db.grades.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-medium">
                          {studentById(g.sid)?.name || g.sid}
                        </div>
                        {g.byName && (
                          <div className="text-xs text-[var(--muted)]">
                            GV: {g.byName}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{g.subject}</td>
                      <td className="py-2.5 px-3 font-mono-num font-bold">
                        {g.value}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--muted)]">
                        {g.term || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--muted)]">
                        {g.note || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => editGrade(g)}
                                className={btnSecondary}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteRecord("grades", g.id)}
                                className={btnDanger}
                              >
                                Xóa
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => requestEdit("grade", g.id)}
                              className={btnSecondary}
                            >
                              Nhờ quản lý sửa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa có điểm
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

  // 7. EVALUATIONS PAGE
  if (page === "evaluations") {
    const handleAddEvaluation = (e: React.FormEvent) => {
      e.preventDefault();
      const note = evalNote.trim();
      if (!effectiveEvalSid || !note) {
        onToast("Vui lòng chọn sinh viên và nhập nội dung.");
        return;
      }
      onUpdateDb((prev) => ({
        ...prev,
        evaluations: [
          ...prev.evaluations,
          {
            id: crypto.randomUUID(),
            sid: effectiveEvalSid,
            level: evalLevel,
            note,
            by: session.role,
            byName:
              session.role === "teacher" ? session.currentTeacher : undefined,
            at: new Date().toISOString(),
          },
        ],
      }));
      setEvalNote("");
      onToast("Đã lưu đánh giá. Bản ghi đã khóa.");
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">
          Đánh giá sinh viên
        </h2>

        {!isAdmin && (
          <div className={noticeClass}>
            Đánh giá sau khi lưu không thể tự chỉnh sửa. Nếu có sai sót, hãy gửi yêu cầu quản lý.
          </div>
        )}

        <form onSubmit={handleAddEvaluation} className={cardClass}>
          <h3 className="text-base font-bold mb-3">Ghi nhận đánh giá</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Sinh viên
              </label>
              <select
                value={effectiveEvalSid}
                onChange={(e) => setEvalSid(e.target.value)}
                className={inputClass}
              >
                {db.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Mức đánh giá
              </label>
              <select
                value={evalLevel}
                onChange={(e) => setEvalLevel(e.target.value)}
                className={inputClass}
              >
                {EVALUATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1.5">
              Nội dung đánh giá
            </label>
            <textarea
              rows={3}
              value={evalNote}
              onChange={(e) => setEvalNote(e.target.value)}
              placeholder="Nhận xét về học tập, thái độ, tinh thần..."
              className={inputClass}
            />
          </div>

          <button type="submit" className={btnPrimary}>
            Lưu đánh giá
          </button>
        </form>

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">Các đánh giá đã ghi</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Sinh viên</th>
                  <th className="py-2.5 px-3">Mức đánh giá</th>
                  <th className="py-2.5 px-3">Nội dung</th>
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {db.evaluations.length > 0 ? (
                  db.evaluations.map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-medium">
                          {studentById(ev.sid)?.name || ev.sid}
                        </div>
                        {ev.byName && (
                          <div className="text-xs text-[var(--muted)]">
                            GV: {ev.byName}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--primary)]">
                        {ev.level}
                      </td>
                      <td className="py-2.5 px-3">{ev.note}</td>
                      <td className="py-2.5 px-3 tabular-nums text-[var(--muted)]">
                        {new Date(ev.at).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => editEvaluation(ev)}
                                className={btnSecondary}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteRecord("evaluations", ev.id)
                                }
                                className={btnDanger}
                              >
                                Xóa
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => requestEdit("evaluation", ev.id)}
                              className={btnSecondary}
                            >
                              Nhờ quản lý sửa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa có đánh giá
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

  // 8. VIOLATIONS PAGE
  if (page === "violations") {
    const vioNoteLabel =
      vioType === "Vắng có phép"
        ? "Lý do vắng (không bắt buộc)"
        : "Ghi chú thêm (nếu có)";

    const handleAddViolation = (e: React.FormEvent) => {
      e.preventDefault();
      const note = vioNote.trim();
      let detail = note;

      if (vioType === "Vào trễ") {
        const mins = Number(lateMinutes);
        if (!Number.isInteger(mins) || mins < 1) {
          onToast("Nhập số phút vào trễ hợp lệ.");
          return;
        }
        detail = `Vào trễ ${mins} phút${note ? ` · ${note}` : ""}`;
      }
      if (vioType === "Bị giáo viên nhắc nhở") {
        const chosenSubject =
          vioSubjectChoice === "__custom__"
            ? vioCustomSubject.trim()
            : vioSubjectChoice;
        if (!chosenSubject) {
          onToast("Vui lòng chọn hoặc nhập môn học.");
          return;
        }
        detail = `Môn ${chosenSubject}${note ? ` · ${note}` : ""}`;
      }
      if (!effectiveVioSid) {
        onToast("Chưa có sinh viên.");
        return;
      }

      const chosenDate = vioDate || toDefaultSchoolDateKey();
      if (isSundayDateKey(chosenDate)) {
        onToast("Không có lịch học vào Chủ nhật. Chọn từ Thứ Hai đến Thứ Bảy.");
        return;
      }

      onUpdateDb((prev) => ({
        ...prev,
        violations: [
          ...prev.violations,
          {
            id: crypto.randomUUID(),
            sid: effectiveVioSid,
            type: vioType,
            detail,
            date: chosenDate,
            by: session.role,
            byName:
              session.role === "officer" ? session.currentOfficer : undefined,
            at: new Date().toISOString(),
          },
        ],
      }));
      setLateMinutes("");
      setVioCustomSubject("");
      setVioNote("");
      onToast("Đã ghi vi phạm. Bản ghi đã khóa.");
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "Quản lý vi phạm" : "Ghi lỗi vi phạm"}
        </h2>

        {!isAdmin && (
          <div className={noticeClass}>
            Ban cán sự chỉ được ghi nhận. Sau khi lưu không thể tự sửa hoặc xóa; nếu sai, hãy gửi yêu cầu quản lý.
          </div>
        )}

        <form onSubmit={handleAddViolation} className={cardClass}>
          <h3 className="text-base font-bold mb-3">Ghi nhận vi phạm mới</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Sinh viên
              </label>
              <select
                value={effectiveVioSid}
                onChange={(e) => setVioSid(e.target.value)}
                className={inputClass}
              >
                {db.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Loại vi phạm
              </label>
              <select
                value={vioType}
                onChange={(e) => setVioType(e.target.value)}
                className={inputClass}
              >
                {VIOLATION_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Ngày vi phạm (Thứ 2 – Thứ 7)
              </label>
              <input
                type="date"
                value={vioDate}
                onChange={(e) => setVioDate(e.target.value)}
                className={inputClass}
              />
              {vioDate && (
                <p
                  className={`text-xs mt-1 ${
                    isSundayDateKey(vioDate)
                      ? "font-semibold text-red-600 dark:text-red-400"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {isSundayDateKey(vioDate)
                    ? "Chủ nhật (không áp dụng — vui lòng chọn Thứ 2 đến Thứ 7)"
                    : `${getRelativeDateLabel(vioDate)} · ${getVietnameseWeekday(
                        vioDate
                      )} (${formatDateVi(vioDate)})`}
                </p>
              )}
            </div>
          </div>

          {vioType === "Vào trễ" && (
            <div className="mb-3">
              <label className="block text-[13px] font-semibold mb-1.5">
                Số phút vào trễ
              </label>
              <input
                type="number"
                min={1}
                value={lateMinutes}
                onChange={(e) => setLateMinutes(e.target.value)}
                placeholder="VD: 10"
                className={inputClass}
              />
            </div>
          )}

          {vioType === "Bị giáo viên nhắc nhở" && (
            <div className="mb-3">
              <label className="block text-[13px] font-semibold mb-1.5">
                Môn học bị nhắc nhở
              </label>
              <select
                value={vioSubjectChoice}
                onChange={(e) => setVioSubjectChoice(e.target.value)}
                className={inputClass}
              >
                {CLASS_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
                <option value="__custom__">+ Nhập môn học khác...</option>
              </select>
              {vioSubjectChoice === "__custom__" && (
                <input
                  type="text"
                  value={vioCustomSubject}
                  onChange={(e) => setVioCustomSubject(e.target.value)}
                  placeholder="Nhập tên môn học"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1.5">
              {vioNoteLabel}
            </label>
            <textarea
              rows={2}
              value={vioNote}
              onChange={(e) => setVioNote(e.target.value)}
              placeholder="Mô tả sự việc..."
              className={inputClass}
            />
          </div>

          <button type="submit" className={btnPrimary}>
            <Plus className="w-4 h-4" />
            <span>Ghi vi phạm</span>
          </button>
        </form>

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">Lịch sử vi phạm</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Sinh viên</th>
                  <th className="py-2.5 px-3">Loại lỗi</th>
                  <th className="py-2.5 px-3">Chi tiết</th>
                  <th className="py-2.5 px-3">Ngày vi phạm</th>
                  <th className="py-2.5 px-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {db.violations.length > 0 ? (
                  db.violations.map((v) => {
                    const dateKey = getViolationDateKey(v);
                    return (
                      <tr
                        key={v.id}
                        className="border-b border-[var(--line)] last:border-b-0"
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-medium">
                            {studentById(v.sid)?.name || v.sid}
                          </div>
                          {v.byName && (
                            <div className="text-xs text-[var(--muted)]">
                              BCS: {v.byName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-red-600 dark:text-red-400">
                          {v.type}
                        </td>
                        <td className="py-2.5 px-3">{v.detail || "—"}</td>
                        <td className="py-2.5 px-3 tabular-nums">
                          <div className="font-semibold text-[var(--ink)]">
                            {getRelativeDateLabel(dateKey)}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {formatDateVi(dateKey)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => editViolation(v)}
                                  className={btnSecondary}
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteRecord("violations", v.id)
                                  }
                                  className={btnDanger}
                                >
                                  Xóa
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => requestEdit("violation", v.id)}
                                className={btnSecondary}
                              >
                                Nhờ quản lý sửa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa có vi phạm
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-base font-bold">
                Xuất lỗi vi phạm thành hình ảnh dạng in
              </h3>
            </div>
            <span className="text-xs text-[var(--muted)] tabular-nums">
              Khổ giấy trắng A4 (PNG)
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mb-4">
            Tạo phiếu tổng hợp lỗi vi phạm nền trắng rõ nét có khung bảng và chữ ký để in hoặc gửi báo cáo trực tiếp.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[13px] font-semibold mb-1">
                Phạm vi xuất phiếu
              </label>
              <select
                value={vioExportScope}
                onChange={(e) => setVioExportScope(e.target.value)}
                className={inputClass}
              >
                <option value="all">
                  Tất cả sinh viên có lỗi ({db.violations.length} lượt)
                </option>
                {db.students.map((s) => {
                  const count = db.violations.filter(
                    (v) => v.sid === s.id
                  ).length;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.id} ({count} lỗi)
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1">
                Tiêu đề phiếu in
              </label>
              <input
                type="text"
                value={vioExportTitle}
                onChange={(e) => setVioExportTitle(e.target.value)}
                placeholder="BẢNG TỔNG HỢP LỖI VI PHẠM"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={vioExportBusy}
              onClick={async () => {
                setVioExportBusy(true);
                try {
                  const targetViolations =
                    vioExportScope === "all"
                      ? db.violations
                      : db.violations.filter((v) => v.sid === vioExportScope);
                  const targetStudent =
                    vioExportScope === "all"
                      ? null
                      : studentById(vioExportScope);
                  const scopeLabel = targetStudent
                    ? `${targetStudent.name} (${targetStudent.id})`
                    : `Toàn lớp ${db.className}`;
                  const exporterName = isAdmin
                    ? "Quản lý lớp"
                    : session.currentOfficer || "Ban cán sự lớp";
                  const rendered = await renderViolationsPrintImage({
                    title: vioExportTitle,
                    scopeLabel,
                    exporterName,
                    db,
                    violations: targetViolations,
                  });
                  setVioExportPreview(rendered.dataUrl);
                  setVioExportDims(`${rendered.width} × ${rendered.height} px`);
                  onToast("Đã tạo ảnh xem trước dạng in.");
                } catch {
                  onToast("Không thể tạo ảnh phiếu vi phạm.");
                } finally {
                  setVioExportBusy(false);
                }
              }}
              className={btnSecondary}
            >
              <Printer className="w-4 h-4" />
              <span>
                {vioExportBusy ? "Đang tạo ảnh..." : "Xem trước ảnh in"}
              </span>
            </button>

            <button
              type="button"
              disabled={vioExportBusy}
              onClick={async () => {
                setVioExportBusy(true);
                try {
                  const targetViolations =
                    vioExportScope === "all"
                      ? db.violations
                      : db.violations.filter((v) => v.sid === vioExportScope);
                  if (targetViolations.length === 0) {
                    onToast("Không có lỗi vi phạm nào để xuất ảnh.");
                    return;
                  }
                  const targetStudent =
                    vioExportScope === "all"
                      ? null
                      : studentById(vioExportScope);
                  const scopeLabel = targetStudent
                    ? `${targetStudent.name} (${targetStudent.id})`
                    : `Toàn lớp ${db.className}`;
                  const exporterName = isAdmin
                    ? "Quản lý lớp"
                    : session.currentOfficer || "Ban cán sự lớp";
                  const rendered = await renderViolationsPrintImage({
                    title: vioExportTitle,
                    scopeLabel,
                    exporterName,
                    db,
                    violations: targetViolations,
                  });
                  setVioExportPreview(rendered.dataUrl);
                  setVioExportDims(`${rendered.width} × ${rendered.height} px`);

                  const blobUrl = URL.createObjectURL(rendered.blob);
                  const link = document.createElement("a");
                  link.href = blobUrl;
                  link.download = targetStudent
                    ? `Vi-pham-${targetStudent.id}.png`
                    : `Phieu-vi-pham-${db.className.replace(/\s+/g, "-")}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(blobUrl);
                  onToast("Đã tải hình ảnh lỗi vi phạm dạng in.");
                } catch {
                  onToast("Không thể xuất ảnh phiếu vi phạm.");
                } finally {
                  setVioExportBusy(false);
                }
              }}
              className={btnPrimary}
            >
              <ImageDown className="w-4 h-4" />
              <span>
                {vioExportBusy ? "Đang xuất ảnh..." : "Tải ảnh PNG dạng in"}
              </span>
            </button>
          </div>

          {vioExportPreview && (
            <div className="mt-4 pt-4 border-t border-[var(--line)] space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Bản xem trước phiếu in</span>
                <span className="font-mono-num">{vioExportDims}</span>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-subtle)] p-3 overflow-auto max-h-[540px]">
                <img
                  src={vioExportPreview}
                  alt="Xem trước phiếu lỗi vi phạm dạng in"
                  className="w-full max-w-[780px] mx-auto block rounded-lg border border-slate-300 shadow-xs bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 8A. VIOLATION SUMMARY PAGE (Trong ngày / 1 tuần / 1 tháng)
  if (page === "violationSummary" && session.role !== "student") {
    return (
      <ViolationSummaryPage db={db} session={session} onToast={onToast} />
    );
  }

  // 8B. CLASS FUND & EXPENSES PAGE (Quỹ lớp, Giáo viên, Quản lý)
  if (page === "fund") {
    const totalIncome = db.fundRecords
      .filter((r) => r.kind === "income")
      .reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = db.fundRecords
      .filter((r) => r.kind === "expense")
      .reduce((sum, r) => sum + r.amount, 0);
    const balance = totalIncome - totalExpense;

    const sortedFunds = [...db.fundRecords].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      return dateCmp !== 0 ? dateCmp : b.at.localeCompare(a.at);
    });

    const q = fundQuery.trim().toLowerCase();
    const filteredFunds = sortedFunds.filter((r) => {
      const matchFilter = fundFilter === "all" || r.kind === fundFilter;
      const matchQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.byName.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });

    const handleAddFundRecord = (e: React.FormEvent) => {
      e.preventDefault();
      if (!canManageFund) return;
      const title = fundTitle.trim();
      const amount = Number(fundAmount);
      if (!title) {
        onToast("Vui lòng nhập nội dung khoản thu / chi.");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        onToast("Vui lòng nhập số tiền hợp lệ lớn hơn 0.");
        return;
      }

      const byName = isAdmin
        ? "Quản lý"
        : session.currentOfficer || "Quỹ lớp";
      const byPosition = isAdmin
        ? "Quản lý"
        : session.currentOfficerPosition || "Quỹ lớp";

      const newRecord: FundRecord = {
        id: crypto.randomUUID(),
        kind: fundKind,
        title,
        amount: Math.round(amount),
        date: fundDate || new Date().toISOString().slice(0, 10),
        note: fundNote.trim(),
        byName,
        byPosition,
        at: new Date().toISOString(),
      };

      onUpdateDb((prev) => ({
        ...prev,
        fundRecords: [newRecord, ...prev.fundRecords],
      }));
      setFundTitle("");
      setFundAmount("");
      setFundNote("");
      onToast(
        fundKind === "expense"
          ? "Đã ghi nhận khoản chi tiêu lớp."
          : "Đã ghi nhận khoản thu quỹ lớp."
      );
    };

    const handleEditFundAmount = (rec: FundRecord) => {
      onOpenModal({
        type: "input",
        title: "Chỉnh sửa số tiền",
        label: `Số tiền mới cho "${rec.title}" (VNĐ)`,
        initialValue: String(rec.amount),
        inputType: "number",
        min: 1,
        step: "1000",
        confirmLabel: "Lưu số tiền",
        onSubmit: (val) => {
          const num = Number(val);
          if (!Number.isFinite(num) || num <= 0) {
            onToast("Số tiền không hợp lệ.");
            return false;
          }
          onUpdateDb((prev) => ({
            ...prev,
            fundRecords: prev.fundRecords.map((item) =>
              item.id === rec.id ? { ...item, amount: Math.round(num) } : item
            ),
          }));
          onToast("Đã cập nhật khoản thu chi.");
        },
      });
    };

    const handleDeleteFundRecord = (rec: FundRecord) => {
      onOpenModal({
        type: "confirm",
        title: "Xóa khoản thu / chi",
        message: `Xóa "${rec.title}" (${formatVnd(rec.amount)}) khỏi sổ quỹ lớp?`,
        confirmLabel: "Xóa",
        danger: true,
        onConfirm: () => {
          onUpdateDb((prev) => ({
            ...prev,
            fundRecords: prev.fundRecords.filter((x) => x.id !== rec.id),
            deletedIds: [...(prev.deletedIds ?? []), rec.id].slice(-500),
          }));
          onToast("Đã xóa bản ghi quỹ lớp.");
        },
      });
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Quản lý quỹ & chi tiêu lớp
          </h2>
          <span className="text-xs text-[var(--muted)] tabular-nums">
            {db.fundRecords.length} giao dịch
          </span>
        </div>

        {!canManageFund && (
          <div className={noticeClass}>
            Chế độ chỉ xem: Giáo viên theo dõi toàn bộ khoản thu, chi tiêu và số dư quỹ lớp do Quỹ lớp và Quản lý cập nhật.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={cardClass}>
            <div className="text-xs font-medium text-[var(--muted)]">
              Tổng thu quỹ lớp
            </div>
            <div className="text-2xl font-extrabold font-mono-num mt-1 text-emerald-600 dark:text-emerald-400">
              {formatVnd(totalIncome)}
            </div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-medium text-[var(--muted)]">
              Tổng chi tiêu
            </div>
            <div className="text-2xl font-extrabold font-mono-num mt-1 text-red-600 dark:text-red-400">
              {formatVnd(totalExpense)}
            </div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-medium text-[var(--muted)]">
              Số dư hiện tại
            </div>
            <div
              className={`text-2xl font-extrabold font-mono-num mt-1 ${
                balance >= 0
                  ? "text-[var(--primary)]"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatVnd(balance)}
            </div>
          </div>
        </div>

        {canManageFund && (
          <form onSubmit={handleAddFundRecord} className={cardClass}>
            <h3 className="text-base font-bold mb-3">
              Ghi nhận khoản thu / chi tiêu mới
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">
                  Loại giao dịch
                </label>
                <select
                  value={fundKind}
                  onChange={(e) =>
                    setFundKind(e.target.value as "expense" | "income")
                  }
                  className={inputClass}
                >
                  <option value="expense">Khoản chi tiêu</option>
                  <option value="income">Khoản thu quỹ</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">
                  Ngày thực hiện
                </label>
                <input
                  type="date"
                  value={fundDate}
                  onChange={(e) => setFundDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">
                  Nội dung khoản {fundKind === "expense" ? "chi" : "thu"}
                </label>
                <input
                  type="text"
                  value={fundTitle}
                  onChange={(e) => setFundTitle(e.target.value)}
                  placeholder={
                    fundKind === "expense"
                      ? "VD: In đề cương, mua nước uống sinh hoạt..."
                      : "VD: Thu quỹ lớp tháng 11, đóng quỹ học kỳ..."
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">
                  Số tiền (VNĐ)
                </label>
                <input
                  type="number"
                  min={1}
                  step="1000"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="VD: 150000"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[13px] font-semibold mb-1.5">
                Ghi chú chi tiết
              </label>
              <textarea
                rows={2}
                value={fundNote}
                onChange={(e) => setFundNote(e.target.value)}
                placeholder="Thông tin hóa đơn, người nhận hoặc ghi chú thêm (không bắt buộc)"
                className={inputClass}
              />
            </div>

            <button type="submit" className={btnPrimary}>
              <Plus className="w-4 h-4" />
              <span>
                {fundKind === "expense" ? "Lưu khoản chi" : "Lưu khoản thu"}
              </span>
            </button>
          </form>
        )}

        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--panel-subtle)] border border-[var(--line)]">
              {(
                [
                  { id: "all", label: "Tất cả" },
                  { id: "expense", label: "Khoản chi" },
                  { id: "income", label: "Khoản thu" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFundFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    fundFilter === tab.id
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={fundQuery}
                onChange={(e) => setFundQuery(e.target.value)}
                placeholder="Tìm nội dung hoặc người ghi..."
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Ngày</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Nội dung</th>
                  <th className="py-2.5 px-3 text-right">Số tiền</th>
                  <th className="py-2.5 px-3">Người ghi</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                  {canManageFund && <th className="py-2.5 px-3">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filteredFunds.length > 0 ? (
                  filteredFunds.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--panel-subtle)]/60"
                    >
                      <td className="py-2.5 px-3 font-mono-num text-[var(--muted)] whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            r.kind === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {r.kind === "income" ? "Khoản thu" : "Khoản chi"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{r.title}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-num font-bold whitespace-nowrap ${
                          r.kind === "income"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {r.kind === "income" ? "+" : "-"}
                        {formatVnd(r.amount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>{r.byName}</div>
                        {r.byPosition && (
                          <div className="text-xs text-[var(--muted)]">
                            {r.byPosition}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--muted)]">
                        {r.note || "—"}
                      </td>
                      {canManageFund && (
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditFundAmount(r)}
                              className={btnSecondary}
                            >
                              Sửa tiền
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFundRecord(r)}
                              className={btnDanger}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={canManageFund ? 7 : 6}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      {db.fundRecords.length > 0
                        ? "Không tìm thấy khoản thu / chi phù hợp"
                        : "Chưa có khoản thu chi nào được ghi nhận"}
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

  // 9. ADMIN TEACHERS MANAGEMENT
  if (page === "teachers") {
    const handleAddTeacher = (e: React.FormEvent) => {
      e.preventDefault();
      const name = teacherName.trim();
      const subject = teacherSubject.trim();
      if (!name) {
        onToast("Nhập tên giáo viên.");
        return;
      }
      onUpdateDb((prev) => ({
        ...prev,
        teachers: [...prev.teachers, { name, subject }],
      }));
      setTeacherName("");
      setTeacherSubject("");
      onToast("Đã thêm giáo viên vào danh sách chọn đăng nhập.");
    };

    const handleDeleteTeacher = (idx: number, name: string) => {
      onOpenModal({
        type: "confirm",
        title: "Xóa giáo viên",
        message: `Xóa giáo viên "${name}" khỏi danh sách?`,
        confirmLabel: "Xóa",
        danger: true,
        onConfirm: () => {
          onUpdateDb((prev) => ({
            ...prev,
            teachers: prev.teachers.filter((_, i) => i !== idx),
          }));
          onToast("Đã xóa giáo viên.");
        },
      });
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">Quản lý giáo viên</h2>

        <form onSubmit={handleAddTeacher} className={cardClass}>
          <h3 className="text-base font-bold mb-1">Thêm giáo viên</h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            Các giáo viên được thêm ở đây sẽ hiển thị trong danh sách chọn tên khi đăng nhập vai trò Giáo viên.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Họ và tên
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Họ tên giáo viên"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Môn phụ trách
              </label>
              <input
                type="text"
                value={teacherSubject}
                onChange={(e) => setTeacherSubject(e.target.value)}
                placeholder="Tên môn học"
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className={btnPrimary}>
            <Plus className="w-4 h-4" />
            <span>Thêm giáo viên</span>
          </button>
        </form>

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">
            Danh sách giáo viên ({db.teachers.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Họ tên</th>
                  <th className="py-2.5 px-3">Môn phụ trách</th>
                  <th className="py-2.5 px-3 w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {db.teachers.length > 0 ? (
                  db.teachers.map((t, idx) => (
                    <tr
                      key={`${t.name}-${idx}`}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="py-2.5 px-3 font-medium">{t.name}</td>
                      <td className="py-2.5 px-3 text-[var(--muted)]">
                        {t.subject || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(idx, t.name)}
                          className={btnDanger}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa thêm giáo viên
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

  // 9B. ADMIN OFFICERS MANAGEMENT
  if (page === "officers") {
    const effectiveOfficerTarget =
      officerTarget === "__custom__"
        ? "__custom__"
        : db.students.some((s) => s.name === officerTarget)
        ? officerTarget
        : db.students[0]?.name ?? "__custom__";

    const handleAddOrUpdateOfficer = (e: React.FormEvent) => {
      e.preventDefault();
      const name =
        effectiveOfficerTarget === "__custom__"
          ? officerCustomName.trim()
          : effectiveOfficerTarget.trim();
      const position = officerPosition.trim();

      if (!name) {
        onToast("Vui lòng chọn sinh viên hoặc nhập tên ban cán sự.");
        return;
      }
      if (!position) {
        onToast("Vui lòng nhập chức vụ (VD: Lớp trưởng, Lớp phó học tập, Quỹ lớp).");
        return;
      }

      const existingIdx = db.officers.findIndex(
        (o) => o.name.trim().toLowerCase() === name.toLowerCase()
      );

      if (existingIdx >= 0) {
        onUpdateDb((prev) => ({
          ...prev,
          officers: prev.officers.map((o, i) =>
            i === existingIdx ? { ...o, position } : o
          ),
        }));
        onToast(`Đã đổi chức vụ cho ${name} thành "${position}".`);
      } else {
        onUpdateDb((prev) => ({
          ...prev,
          officers: [...prev.officers, { name, position }],
        }));
        onToast("Đã thêm ban cán sự vào danh sách chọn đăng nhập.");
      }

      setOfficerCustomName("");
      setOfficerPosition("");
    };

    const handleChangeOfficerPosition = (idx: number, o: { name: string; position: string }) => {
      onOpenModal({
        type: "input",
        title: "Đổi chức vụ ban cán sự",
        label: `Chức vụ mới cho ${o.name}`,
        initialValue: o.position,
        placeholder: "VD: Lớp trưởng, Lớp phó học tập, Quỹ lớp, Bí thư...",
        confirmLabel: "Lưu chức vụ",
        onSubmit: (newPos) => {
          const trimmed = newPos.trim();
          if (!trimmed) {
            onToast("Vui lòng nhập chức vụ.");
            return false;
          }
          onUpdateDb((prev) => ({
            ...prev,
            officers: prev.officers.map((item, i) =>
              i === idx ? { ...item, position: trimmed } : item
            ),
          }));
          onToast(`Đã đổi chức vụ của ${o.name} thành "${trimmed}".`);
        },
      });
    };

    const handleDeleteOfficer = (idx: number, name: string) => {
      onOpenModal({
        type: "confirm",
        title: "Xóa ban cán sự",
        message: `Xóa "${name}" khỏi danh sách ban cán sự?`,
        confirmLabel: "Xóa",
        danger: true,
        onConfirm: () => {
          onUpdateDb((prev) => ({
            ...prev,
            officers: prev.officers.filter((_, i) => i !== idx),
          }));
          onToast("Đã xóa ban cán sự.");
        },
      });
    };

    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">Quản lý ban cán sự lớp</h2>

        <form onSubmit={handleAddOrUpdateOfficer} className={cardClass}>
          <h3 className="text-base font-bold mb-1">
            Thêm ban cán sự / gán chức vụ cho sinh viên
          </h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            Chọn sinh viên trong lớp (hoặc nhập tên mới) và nhập chức vụ. Nếu sinh viên đã có trong ban cán sự, hệ thống sẽ cập nhật chức vụ mới.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Chọn sinh viên / tên ban cán sự
              </label>
              <select
                value={effectiveOfficerTarget}
                onChange={(e) => setOfficerTarget(e.target.value)}
                className={inputClass}
              >
                {db.students.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} · {s.id}
                  </option>
                ))}
                <option value="__custom__">+ Nhập tên khác...</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">
                Chức vụ
              </label>
              <input
                type="text"
                value={officerPosition}
                onChange={(e) => setOfficerPosition(e.target.value)}
                placeholder="VD: Lớp trưởng, Lớp phó học tập, Quỹ lớp..."
                className={inputClass}
              />
            </div>
          </div>

          {effectiveOfficerTarget === "__custom__" && (
            <div className="mb-4">
              <label className="block text-[13px] font-semibold mb-1.5">
                Họ và tên ban cán sự
              </label>
              <input
                type="text"
                value={officerCustomName}
                onChange={(e) => setOfficerCustomName(e.target.value)}
                placeholder="Nhập họ và tên"
                className={inputClass}
              />
            </div>
          )}

          <button type="submit" className={btnPrimary}>
            <Plus className="w-4 h-4" />
            <span>Thêm / cập nhật ban cán sự</span>
          </button>
        </form>

        <div className={cardClass}>
          <h3 className="text-base font-bold mb-3">
            Danh sách ban cán sự ({db.officers.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Họ tên</th>
                  <th className="py-2.5 px-3">Chức vụ</th>
                  <th className="py-2.5 px-3 w-48">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {db.officers.length > 0 ? (
                  db.officers.map((o, idx) => (
                    <tr
                      key={`${o.name}-${idx}`}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="py-2.5 px-3 font-medium">{o.name}</td>
                      <td className="py-2.5 px-3 text-[var(--muted)]">
                        {o.position || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeOfficerPosition(idx, o)}
                            className={btnSecondary}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Đổi chức vụ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOfficer(idx, o.name)}
                            className={btnDanger}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa thêm ban cán sự
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

  // 10. ADMIN REQUESTS PAGE
  if (page === "requests") {
    const handleOpenRequestRecord = (r: EditRequest) => {
      if (r.kind === "grade") {
        const rec = db.grades.find((x) => x.id === r.recordId);
        if (!rec) return onToast("Không tìm thấy bản ghi (có thể đã bị xóa).");
        editGrade(rec);
      } else if (r.kind === "evaluation") {
        const rec = db.evaluations.find((x) => x.id === r.recordId);
        if (!rec) return onToast("Không tìm thấy bản ghi (có thể đã bị xóa).");
        editEvaluation(rec);
      } else {
        const rec = db.violations.find((x) => x.id === r.recordId);
        if (!rec) return onToast("Không tìm thấy bản ghi (có thể đã bị xóa).");
        editViolation(rec);
      }
    };

    const closeRequest = (id: string) => {
      onUpdateDb((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.id === id ? { ...r, status: "Đã xử lý" } : r
        ),
      }));
      onToast("Đã đánh dấu yêu cầu đã xử lý.");
    };

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Yêu cầu chỉnh sửa từ giáo viên / ban cán sự
        </h2>

        <div className={cardClass}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--panel-subtle)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Nội dung yêu cầu</th>
                  <th className="py-2.5 px-3">Người gửi</th>
                  <th className="py-2.5 px-3">Ngày gửi</th>
                  <th className="py-2.5 px-3">Trạng thái / xử lý</th>
                </tr>
              </thead>
              <tbody>
                {db.requests.length > 0 ? (
                  db.requests.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {requestKindLabel(r.kind)}
                      </td>
                      <td className="py-2.5 px-3">{r.reason}</td>
                      <td className="py-2.5 px-3">
                        {r.fromName
                          ? `${r.fromName} · ${roleText(r.from)}`
                          : roleText(r.from)}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[var(--muted)]">
                        {new Date(r.at).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.status === "Chờ xử lý" ? (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                              Chờ xử lý
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenRequestRecord(r)}
                                className={btnSecondary}
                              >
                                Mở bản ghi
                              </button>
                              <button
                                type="button"
                                onClick={() => closeRequest(r.id)}
                                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#16a36a] hover:bg-[#128757] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Đánh dấu xong
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            Đã xử lý
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-[var(--muted)]"
                    >
                      Chưa có yêu cầu nào
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

  // 11. ADMIN SETTINGS PAGE
  const themes: { id: ThemeMode; label: string; gradient: string }[] = [
    {
      id: "default",
      label: "Mặc định",
      gradient: "linear-gradient(90deg, #10254b 35%, #1769e8 35%)",
    },
    {
      id: "dark",
      label: "Tối (Dark)",
      gradient: "linear-gradient(90deg, #0b1424 35%, #344b6b 35%)",
    },
    {
      id: "sakura",
      label: "Sakura",
      gradient: "linear-gradient(90deg, #522844 35%, #d84d91 35%)",
    },
    {
      id: "green",
      label: "Xanh lá",
      gradient: "linear-gradient(90deg, #123e36 35%, #16865b 35%)",
    },
  ];

  const handleSaveClassInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const defaults = cloneDefaults();
    onUpdateDb((prev) => ({
      ...prev,
      className: classNameInput.trim() || defaults.className,
      school: schoolInput.trim() || defaults.school,
    }));
    onToast("Đã lưu thông tin lớp.");
  };

  const handleChangePasswords = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherPass && !newAdminPass && !newOfficerPass) {
      onToast("Chưa nhập mật khẩu mới.");
      return;
    }
    onUpdateDb((prev) => ({
      ...prev,
      teacherPass: newTeacherPass || prev.teacherPass,
      adminPass: newAdminPass || prev.adminPass,
      officerPass: newOfficerPass || prev.officerPass,
    }));
    setNewTeacherPass("");
    setNewAdminPass("");
    setNewOfficerPass("");
    onToast("Đã cập nhật mật khẩu.");
  };

  const handleExportData = async () => {
    try {
      await exportAndAutoImportFromServer(db, {
        downloadFile: true,
        pushLocalFirst: true,
      });
      onToast("Đã xuất dữ liệu JSON từ máy chủ.");
    } catch {
      triggerJsonFileDownload(JSON.stringify(db, null, 2), "CNTT1-9K7-backup.json");
      onToast("Đã xuất dữ liệu JSON.");
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.students)) {
          throw new Error("Invalid JSON");
        }
        const merged = normalizeDatabase(parsed);
        onUpdateDb(() => merged);
        setClassNameInput(merged.className);
        setSchoolInput(merged.school);
        onToast("Đã nhập dữ liệu và đồng bộ lên máy chủ.");
      } catch {
        onToast("Tệp JSON không hợp lệ.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">Cài đặt hệ thống</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-base font-bold">Giao diện</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {themes.map((t) => {
              const active = db.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    onUpdateDb((prev) => ({ ...prev, theme: t.id }))
                  }
                  className={`p-3 rounded-xl border-2 text-left text-xs font-semibold transition-colors cursor-pointer bg-[var(--panel)] text-[var(--ink)] ${
                    active
                      ? "border-[var(--primary)]"
                      : "border-[var(--line)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <div
                    className="w-16 h-9 rounded-lg mb-2"
                    style={{ background: t.gradient }}
                  />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSaveClassInfo} className={cardClass}>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-base font-bold">Thông tin lớp</h3>
          </div>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-[13px] font-semibold mb-1">
                Tên lớp
              </label>
              <input
                type="text"
                value={classNameInput}
                onChange={(e) => setClassNameInput(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1">
                Tên trường
              </label>
              <input
                type="text"
                value={schoolInput}
                onChange={(e) => setSchoolInput(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className={btnPrimary}>
            Lưu thông tin
          </button>
        </form>
      </div>

      <form onSubmit={handleChangePasswords} className={cardClass}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-[var(--primary)]" />
          <h3 className="text-base font-bold">Đổi mật khẩu</h3>
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          Đổi mật khẩu đăng nhập của giáo viên, quản lý và ban cán sự lớp.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[13px] font-semibold mb-1">
              Mật khẩu giáo viên mới
            </label>
            <input
              type="password"
              value={newTeacherPass}
              onChange={(e) => setNewTeacherPass(e.target.value)}
              placeholder="Nhập mật khẩu mới"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1">
              Mật khẩu quản lý mới
            </label>
            <input
              type="password"
              value={newAdminPass}
              onChange={(e) => setNewAdminPass(e.target.value)}
              placeholder="Nhập mật khẩu mới"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1">
              Mật khẩu ban cán sự mới
            </label>
            <input
              type="password"
              value={newOfficerPass}
              onChange={(e) => setNewOfficerPass(e.target.value)}
              placeholder="Nhập mật khẩu mới"
              className={inputClass}
            />
          </div>
        </div>
        <button type="submit" className={btnPrimary}>
          Cập nhật mật khẩu
        </button>
      </form>

      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-[var(--primary)]" />
          <h3 className="text-base font-bold">Sao lưu dữ liệu</h3>
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          Xuất dữ liệu lớp ra tệp JSON để lưu trữ; có thể nhập lại bản sao lưu trên trình duyệt này.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Xuất dữ liệu JSON</span>
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4" />
            <span>Nhập dữ liệu JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>
          <button
            type="button"
            disabled={importingFromServer || sendingToServer}
            onClick={() => void onImportFromServer()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] text-sm font-semibold hover:border-[var(--primary)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw
              className={`w-4 h-4 ${importingFromServer ? "animate-spin" : ""}`}
            />
            <span>
              {importingFromServer ? "Đang nhập..." : "Nhập từ máy chủ"}
            </span>
          </button>
          <button
            type="button"
            disabled={sendingToServer || importingFromServer}
            onClick={() => void onSendToServer()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            <span>
              {sendingToServer ? "Đang gửi..." : "Gửi về máy chủ"}
            </span>
          </button>
        </div>
      </div>

      <div className={noticeClass}>
        Lưu ý bảo mật: ứng dụng lưu dữ liệu cục bộ trong trình duyệt (localStorage). Không dùng để lưu thông tin nhạy cảm hoặc công khai trên Internet khi chưa có máy chủ xác thực.
      </div>
    </div>
  );
}

export function getMenusForRole(
  role: Role,
  session?: SessionState
): { id: PageId; label: string; icon: typeof Users }[] {
  switch (role) {
    case "student":
      return [
        { id: "home", label: "Trang chủ", icon: GraduationCap },
        { id: "announcements", label: "Thông báo", icon: Bell },
        { id: "members", label: "Danh sách lớp", icon: Users },
        { id: "myGrades", label: "Bảng điểm cá nhân", icon: PenLine },
        { id: "myViolations", label: "Vi phạm của tôi", icon: Flag },
      ];
    case "teacher":
      return [
        { id: "home", label: "Trang chủ", icon: GraduationCap },
        { id: "announcements", label: "Thông báo", icon: Bell },
        { id: "grades", label: "Nhập điểm", icon: PenLine },
        { id: "evaluations", label: "Đánh giá sinh viên", icon: Star },
        { id: "violationSummary", label: "Tổng kết vi phạm", icon: BarChart3 },
        { id: "fund", label: "Quỹ & chi tiêu lớp", icon: Wallet },
        { id: "members", label: "Danh sách lớp", icon: Users },
      ];
    case "officer":
      return [
        { id: "home", label: "Trang chủ", icon: GraduationCap },
        { id: "announcements", label: "Thông báo", icon: Bell },
        { id: "violations", label: "Ghi lỗi vi phạm", icon: Flag },
        { id: "violationSummary", label: "Tổng kết vi phạm", icon: BarChart3 },
        ...(session && isTreasurerSession(session)
          ? [{ id: "fund" as PageId, label: "Quỹ & chi tiêu lớp", icon: Wallet }]
          : []),
        { id: "members", label: "Danh sách lớp", icon: Users },
      ];
    case "admin":
      return [
        { id: "home", label: "Trang chủ", icon: GraduationCap },
        { id: "announcements", label: "Thông báo", icon: Bell },
        { id: "students", label: "Quản lý sinh viên", icon: Users },
        { id: "grades", label: "Quản lý điểm", icon: PenLine },
        { id: "evaluations", label: "Đánh giá sinh viên", icon: Star },
        { id: "violations", label: "Quản lý vi phạm", icon: Flag },
        { id: "violationSummary", label: "Tổng kết vi phạm", icon: BarChart3 },
        { id: "fund", label: "Quỹ & chi tiêu lớp", icon: Wallet },
        { id: "teachers", label: "Quản lý giáo viên", icon: GraduationCap },
        { id: "officers", label: "Quản lý ban cán sự", icon: ClipboardList },
        { id: "requests", label: "Yêu cầu chỉnh sửa", icon: Mail },
        { id: "settings", label: "Cài đặt giao diện", icon: Settings },
      ];
  }
}

export function getPageTitle(page: PageId, role: Role): string {
  switch (page) {
    case "home":
      return "Trang chủ";
    case "announcements":
      return "Thông báo lớp học";
    case "members":
      return "Danh sách thành viên lớp";
    case "myGrades":
      return "Bảng điểm cá nhân";
    case "myViolations":
      return "Vi phạm của tôi";
    case "students":
      return "Quản lý sinh viên";
    case "grades":
      return role === "admin" ? "Quản lý điểm" : "Nhập điểm";
    case "evaluations":
      return "Đánh giá sinh viên";
    case "violations":
      return "Ghi lỗi vi phạm";
    case "violationSummary":
      return "Tổng kết vi phạm";
    case "fund":
      return "Quản lý quỹ & chi tiêu lớp";
    case "teachers":
      return "Quản lý giáo viên";
    case "officers":
      return "Quản lý ban cán sự lớp";
    case "requests":
      return "Yêu cầu chỉnh sửa";
    case "settings":
      return "Cài đặt hệ thống";
  }
}
