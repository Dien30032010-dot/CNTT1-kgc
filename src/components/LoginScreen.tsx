import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ClipboardList,
  Copy,
  Database,
  Download,
  ExternalLink,
  Globe,
  GraduationCap,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  exportAndAutoImportFromServer,
  importFromServer,
  sendToServerAndMerge,
  syncWithServerOnLoad,
} from "../lib/serverSync";
import type { ClassDatabase, Role, SessionState } from "../types";
import { ClassLogo } from "./ClassLogo";

const SHARED_APP_URL =
  "https://ais-pre-nbuqvlryqgfruqhjq5a5p3-233495345743.asia-northeast1.run.app";

interface LoginScreenProps {
  db: ClassDatabase;
  onLogin: (session: SessionState) => void;
  onApplyDatabase: (nextDb: ClassDatabase, updatedAt?: number) => void;
}

const ROLE_OPTIONS: {
  id: Role;
  label: string;
  desc: string;
  icon: typeof GraduationCap;
}[] = [
  { id: "student", label: "Sinh viên", desc: "Không cần mật khẩu", icon: GraduationCap },
  { id: "teacher", label: "Giáo viên", desc: "Chọn tên & mật khẩu", icon: BookOpenCheck },
  { id: "admin", label: "Quản lý", desc: "Toàn quyền hệ thống", icon: ShieldCheck },
  { id: "officer", label: "Ban cán sự lớp", desc: "Chọn tên & mật khẩu", icon: ClipboardList },
];

export function LoginScreen({ db, onLogin, onApplyDatabase }: LoginScreenProps) {
  const [role, setRole] = useState<Role>("student");
  const [studentIdx, setStudentIdx] = useState<string>("0");

  const [teacherChoice, setTeacherChoice] = useState<string>(() =>
    db.teachers.length > 0 ? "0" : "__custom__"
  );
  const [customTeacherName, setCustomTeacherName] = useState<string>("");

  const [officerIdx, setOfficerIdx] = useState<string>("0");

  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [syncBusy, setSyncBusy] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string>("");
  const didAutoSyncRef = useRef<boolean>(false);

  const websiteUrl =
    typeof window !== "undefined" &&
    window.location.origin.startsWith("https://") &&
    !window.location.hostname.startsWith("ais-dev-")
      ? window.location.origin
      : SHARED_APP_URL;

  useEffect(() => {
    if (didAutoSyncRef.current) return;
    didAutoSyncRef.current = true;
    let cancelled = false;

    void (async () => {
      const result = await syncWithServerOnLoad(db);
      if (cancelled) return;
      if (result.action === "imported") {
        onApplyDatabase(result.db, result.updatedAt);
        setSyncNotice("Đã tự động nhập dữ liệu JSON mới nhất từ máy chủ.");
      } else if (result.action === "exported") {
        setSyncNotice("Đã tự động xuất dữ liệu JSON lên máy chủ.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, onApplyDatabase]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopyWebsiteUrl = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(websiteUrl);
        setCopied(true);
      }
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const handleAutoExportAndImport = async (downloadFile: boolean) => {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncNotice("");
    try {
      const result = downloadFile
        ? await exportAndAutoImportFromServer(db, { downloadFile: true })
        : await importFromServer(db);
      onApplyDatabase(result.db, result.updatedAt);
      setSyncNotice(
        downloadFile
          ? "Đã xuất CNTT1-9K7-backup.json từ máy chủ và tự động nhập dữ liệu."
          : "Đã nhập dữ liệu JSON mới nhất từ máy chủ."
      );
    } catch {
      setSyncNotice("Không thể kết nối máy chủ để xuất/nhập JSON.");
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSendToServerFromLogin = async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncNotice("");
    try {
      const result = await sendToServerAndMerge(db, "Trang đăng nhập");
      onApplyDatabase(result.db, result.updatedAt);
      setSyncNotice("Đã gửi dữ liệu về máy chủ và đồng bộ bản mới nhất.");
    } catch {
      setSyncNotice("Không thể gửi dữ liệu về máy chủ.");
    } finally {
      setSyncBusy(false);
    }
  };

  useEffect(() => {
    if (db.teachers.length > 0 && teacherChoice === "__custom__" && !customTeacherName) {
      setTeacherChoice("0");
    } else if (db.teachers.length === 0) {
      setTeacherChoice("__custom__");
    } else if (
      teacherChoice !== "__custom__" &&
      Number(teacherChoice) >= db.teachers.length
    ) {
      setTeacherChoice("0");
    }
  }, [db.teachers.length, teacherChoice, customTeacherName]);

  useEffect(() => {
    if (db.officers.length > 0 && Number(officerIdx) >= db.officers.length) {
      setOfficerIdx("0");
    }
  }, [db.officers.length, officerIdx]);

  const handleSelectRole = (nextRole: Role) => {
    setRole(nextRole);
    setError("");
    setPassword("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (role === "student") {
      const idx = Number(studentIdx);
      const student = db.students[idx];
      if (!student) {
        setError("Chưa có sinh viên. Hãy liên hệ quản lý lớp.");
        return;
      }
      onLogin({
        role: "student",
        currentStudent: student.id,
        currentTeacher: "",
        currentTeacherSubject: "",
        currentOfficer: "",
        currentOfficerPosition: "",
      });
      return;
    }

    let chosenTeacherName = "";
    let chosenTeacherSubject = "";
    let chosenOfficerName = "";
    let chosenOfficerPosition = "";

    if (role === "teacher") {
      if (teacherChoice === "__custom__" || db.teachers.length === 0) {
        chosenTeacherName = customTeacherName.trim();
        if (!chosenTeacherName) {
          setError("Vui lòng chọn hoặc nhập tên giáo viên trước khi đăng nhập.");
          return;
        }
      } else {
        const t = db.teachers[Number(teacherChoice)];
        if (!t) {
          setError("Vui lòng chọn tên giáo viên hợp lệ.");
          return;
        }
        chosenTeacherName = t.name;
        chosenTeacherSubject = t.subject || "";
      }
    }

    if (role === "officer") {
      const o = db.officers[Number(officerIdx)];
      if (!o) {
        setError("Chưa có ban cán sự lớp. Hãy liên hệ quản lý để thêm.");
        return;
      }
      chosenOfficerName = o.name;
      chosenOfficerPosition = o.position || "";
    }

    const expected =
      role === "teacher"
        ? db.teacherPass
        : role === "admin"
        ? db.adminPass
        : db.officerPass;

    if (password !== expected) {
      setError("Mật khẩu không đúng.");
      return;
    }

    onLogin({
      role,
      currentStudent: "",
      currentTeacher: role === "teacher" ? chosenTeacherName : "",
      currentTeacherSubject: role === "teacher" ? chosenTeacherSubject : "",
      currentOfficer: role === "officer" ? chosenOfficerName : "",
      currentOfficerPosition: role === "officer" ? chosenOfficerPosition : "",
    });
  };

  const passwordLabel =
    role === "teacher"
      ? "Mật khẩu giáo viên"
      : role === "admin"
      ? "Mật khẩu quản lý"
      : "Mật khẩu ban cán sự lớp";

  const showCustomTeacherInput =
    role === "teacher" && (teacherChoice === "__custom__" || db.teachers.length === 0);

  return (
    <div
      className="min-h-screen grid place-items-center p-4 md:p-6"
      style={{
        background:
          "radial-gradient(circle at 15% 15%, #1c5eaa 0%, transparent 34%), linear-gradient(135deg, #07172f, #102b55 60%, #06152d)",
      }}
    >
      <div className="w-full max-w-[980px] grid grid-cols-1 md:grid-cols-2 overflow-hidden border border-[#4773ad] rounded-3xl bg-[#10264a] shadow-2xl">
        <section className="p-7 md:p-9 text-white flex flex-col justify-center items-center text-center bg-gradient-to-br from-[#102d5b] to-[#06162f]">
          <ClassLogo size="lg" />
          <h1 className="text-2xl md:text-[32px] font-extrabold tracking-tight mt-4 mb-1">
            {db.className}
          </h1>
          <p className="text-[#b8d2ff] text-sm font-medium tracking-wide">
            HỆ THỐNG QUẢN LÝ LỚP
          </p>
          <p className="mt-6 text-sm text-[#b8d2ff]/90 italic max-w-xs">
            Cùng học tập · Cùng tiến bộ · Cùng phát triển
          </p>
        </section>

        <section className="p-6 md:p-8 bg-[var(--panel)] text-[var(--ink)] flex flex-col justify-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Đăng nhập hệ thống</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Chọn đúng vai trò để tiếp tục.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 my-5" role="radiogroup" aria-label="Vai trò đăng nhập">
            {ROLE_OPTIONS.map((item) => {
              const Icon = item.icon;
              const active = role === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelectRole(item.id)}
                  className={`text-left p-3 rounded-xl border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                    active
                      ? "border-2 border-[var(--primary)] bg-[var(--primary-soft)]"
                      : "border-[var(--line)] bg-[var(--panel-subtle)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-[var(--ink)]">
                    <Icon className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                    {item.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {role === "student" && (
              <div>
                <label
                  htmlFor="studentSelect"
                  className="block text-[13px] font-semibold mb-1.5"
                >
                  Chọn tên sinh viên
                </label>
                <select
                  id="studentSelect"
                  value={studentIdx}
                  onChange={(e) => setStudentIdx(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  {db.students.length > 0 ? (
                    db.students.map((s, idx) => (
                      <option key={s.id} value={String(idx)}>
                        {s.name} · {s.id}
                      </option>
                    ))
                  ) : (
                    <option value="">Chưa có sinh viên</option>
                  )}
                </select>
              </div>
            )}

            {role === "teacher" && (
              <>
                <div>
                  <label
                    htmlFor="teacherSelect"
                    className="block text-[13px] font-semibold mb-1.5"
                  >
                    Chọn tên giáo viên
                  </label>
                  <select
                    id="teacherSelect"
                    value={teacherChoice}
                    onChange={(e) => {
                      setTeacherChoice(e.target.value);
                      setError("");
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                  >
                    {db.teachers.map((t, idx) => (
                      <option key={`${t.name}-${idx}`} value={String(idx)}>
                        {t.name}
                        {t.subject ? ` · ${t.subject}` : ""}
                      </option>
                    ))}
                    <option value="__custom__">
                      {db.teachers.length > 0
                        ? "+ Nhập tên giáo viên khác..."
                        : "Tự nhập tên giáo viên"}
                    </option>
                  </select>
                </div>

                {showCustomTeacherInput && (
                  <div>
                    <label
                      htmlFor="customTeacherInput"
                      className="block text-[13px] font-semibold mb-1.5"
                    >
                      Họ và tên giáo viên
                    </label>
                    <input
                      id="customTeacherInput"
                      type="text"
                      value={customTeacherName}
                      onChange={(e) => {
                        setCustomTeacherName(e.target.value);
                        setError("");
                      }}
                      placeholder="VD: Nguyễn Thị Minh"
                      autoComplete="name"
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                    {db.teachers.length === 0 && (
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Quản lý có thể thêm danh sách giáo viên cố định trong mục Quản lý giáo viên.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {role === "officer" && (
              <div>
                <label
                  htmlFor="officerSelect"
                  className="block text-[13px] font-semibold mb-1.5"
                >
                  Chọn tên ban cán sự lớp
                </label>
                <select
                  id="officerSelect"
                  value={officerIdx}
                  onChange={(e) => {
                    setOfficerIdx(e.target.value);
                    setError("");
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  {db.officers.length > 0 ? (
                    db.officers.map((o, idx) => (
                      <option key={`${o.name}-${idx}`} value={String(idx)}>
                        {o.name}
                        {o.position ? ` · ${o.position}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">Chưa có ban cán sự lớp</option>
                  )}
                </select>
              </div>
            )}

            {role !== "student" && (
              <div>
                <label
                  htmlFor="loginPassword"
                  className="block text-[13px] font-semibold mb-1.5"
                >
                  {passwordLabel}
                </label>
                <input
                  id="loginPassword"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
            )}

            {error && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Đăng nhập</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[var(--line)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                <Globe className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                <span>Link mở website (chia sẻ cho tài khoản khác)</span>
              </span>
              <button
                type="button"
                onClick={handleCopyWebsiteUrl}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép link</span>
                  </>
                )}
              </button>
            </div>

            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--panel-subtle)] hover:border-[var(--primary)] text-xs transition-colors group"
            >
              <span className="font-mono-num text-[var(--primary)] truncate">
                {websiteUrl}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink)] group-hover:text-[var(--primary)] shrink-0">
                <span>Mở</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </a>

            <div className="mt-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--panel-subtle)]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] mb-2">
                <Database className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                <span>Dữ liệu JSON máy chủ</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void handleAutoExportAndImport(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {syncBusy ? "Đang xử lý..." : "Xuất & tự động nhập JSON"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void handleAutoExportAndImport(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] text-xs font-semibold hover:border-[var(--primary)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncBusy ? "animate-spin" : ""}`} />
                  <span>Nhập từ máy chủ</span>
                </button>
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void handleSendToServerFromLogin()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>Gửi về máy chủ</span>
                </button>
              </div>
              {syncNotice && (
                <p className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
                  {syncNotice}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-[var(--muted)] mt-4">
            {db.className} · {db.school}
          </p>
        </section>
      </div>
    </div>
  );
}
