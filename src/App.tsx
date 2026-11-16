import { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw, Send } from "lucide-react";
import { ClassLogo } from "./components/ClassLogo";
import {
  DashboardPages,
  getMenusForRole,
  getPageTitle,
} from "./components/DashboardPages";
import { LoginScreen } from "./components/LoginScreen";
import { ModalDialog, type ModalConfig } from "./components/ModalDialog";
import {
  applyThemeClass,
  loadDatabase,
  saveDatabase,
  setLocalUpdatedAt,
} from "./data/defaults";
import {
  importFromServer,
  pushDatabaseToServer,
  sendToServerAndMerge,
} from "./lib/serverSync";
import type { ClassDatabase, PageId, SessionState } from "./types";

export default function App() {
  const [db, setDb] = useState<ClassDatabase>(() => loadDatabase());
  const [session, setSession] = useState<SessionState | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [toast, setToast] = useState<string>("");
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [importingFromServer, setImportingFromServer] = useState<boolean>(false);
  const [sendingToServer, setSendingToServer] = useState<boolean>(false);

  useEffect(() => {
    applyThemeClass(db.theme);
  }, [db.theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleUpdateDb = useCallback(
    (updater: (prev: ClassDatabase) => ClassDatabase) => {
      setDb((prev) => {
        const next = updater(prev);
        const now = Date.now();
        saveDatabase(next);
        setLocalUpdatedAt(now);
        void pushDatabaseToServer(next, now);
        return next;
      });
    },
    []
  );

  const handleApplyDatabase = useCallback(
    (nextDb: ClassDatabase, updatedAt?: number) => {
      saveDatabase(nextDb);
      if (typeof updatedAt === "number" && updatedAt > 0) {
        setLocalUpdatedAt(updatedAt);
      }
      setDb(nextDb);
    },
    []
  );

  const handleImportFromServer = useCallback(async () => {
    if (importingFromServer || sendingToServer) return;
    setImportingFromServer(true);
    try {
      const result = await importFromServer(db);
      handleApplyDatabase(result.db, result.updatedAt);
      showToast("Đã nhập dữ liệu mới nhất từ máy chủ.");
    } catch {
      showToast("Không thể kết nối máy chủ để nhập dữ liệu.");
    } finally {
      setImportingFromServer(false);
    }
  }, [db, handleApplyDatabase, importingFromServer, sendingToServer, showToast]);

  const handleSendToServer = useCallback(async () => {
    if (sendingToServer || importingFromServer) return;
    setSendingToServer(true);
    try {
      const senderLabel = session
        ? session.role === "student"
          ? db.students.find((s) => s.id === session.currentStudent)?.name ||
            "Sinh viên"
          : session.role === "teacher"
          ? session.currentTeacher || "Giáo viên"
          : session.role === "admin"
          ? "Quản lý"
          : session.currentOfficer || "Ban cán sự lớp"
        : undefined;
      const result = await sendToServerAndMerge(db, senderLabel);
      handleApplyDatabase(result.db, result.updatedAt);
      showToast("Đã gửi chỉnh sửa lên máy chủ và đồng bộ bản mới nhất.");
    } catch {
      showToast("Không thể kết nối máy chủ để gửi dữ liệu.");
    } finally {
      setSendingToServer(false);
    }
  }, [
    db,
    handleApplyDatabase,
    importingFromServer,
    sendingToServer,
    session,
    showToast,
  ]);

  const handleLogin = (nextSession: SessionState) => {
    setSession(nextSession);
    setPage("home");
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setSession(null);
    setPage("home");
  };

  const handleNavigate = (nextPage: PageId) => {
    setPage(nextPage);
    window.scrollTo(0, 0);
  };

  if (!session) {
    return (
      <LoginScreen
        db={db}
        onLogin={handleLogin}
        onApplyDatabase={handleApplyDatabase}
      />
    );
  }

  const menus = getMenusForRole(session.role, session);
  const studentName =
    db.students.find((s) => s.id === session.currentStudent)?.name ||
    "Sinh viên";

  const displayName =
    session.role === "student"
      ? studentName
      : session.role === "teacher"
      ? session.currentTeacher || "Giáo viên"
      : session.role === "admin"
      ? "Quản lý"
      : session.currentOfficer || "Ban cán sự lớp";

  const displayRole =
    session.role === "student"
      ? "Sinh viên"
      : session.role === "teacher"
      ? session.currentTeacherSubject
        ? `Giáo viên · ${session.currentTeacherSubject}`
        : "Giáo viên"
      : session.role === "admin"
      ? "Quản lý"
      : session.currentOfficerPosition
      ? `Ban cán sự lớp · ${session.currentOfficerPosition}`
      : "Ban cán sự lớp";

  const avatarCode =
    session.role === "student"
      ? "SV"
      : session.role === "teacher"
      ? "GV"
      : session.role === "admin"
      ? "QL"
      : "BCS";

  const pendingRequestsCount = db.requests.filter(
    (r) => r.status === "Chờ xử lý"
  ).length;

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[256px_1fr] bg-[var(--bg)] text-[var(--ink)]">
      {/* Sidebar */}
      <aside className="bg-[var(--nav)] text-white p-3 md:p-4 flex flex-col gap-3 md:gap-5">
        <div className="flex items-center gap-3 px-2 py-1 md:pb-4 md:border-b md:border-white/15">
          <ClassLogo size="sm" />
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight truncate">
              {db.className}
            </div>
            <div className="hidden md:block text-[11px] text-[#a9c8ff] tracking-wide mt-0.5">
              QUẢN LÝ LỚP HỌC
            </div>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {menus.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-[var(--nav-active)] text-white font-semibold"
                    : "text-[#d8e5ff] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === "requests" && pendingRequestsCount > 0 && (
                  <span className="text-xs font-mono-num font-bold text-amber-300">
                    {pendingRequestsCount}
                  </span>
                )}
                {item.id === "announcements" && db.announcements.length > 0 && (
                  <span className="text-xs font-mono-num font-bold text-sky-200">
                    {db.announcements.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:block mt-auto">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/25 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex flex-col">
        <header className="h-16 md:h-[70px] bg-[var(--panel)] border-b border-[var(--line)] px-4 md:px-7 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold truncate">
              {getPageTitle(page, session.role)}
            </h1>
            <p className="hidden sm:block text-xs text-[var(--muted)] truncate">
              Hệ thống quản lý lớp {db.className}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              disabled={importingFromServer || sendingToServer}
              onClick={() => void handleImportFromServer()}
              title="Nhập dữ liệu mới nhất từ máy chủ"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${importingFromServer ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {importingFromServer ? "Đang nhập..." : "Nhập từ máy chủ"}
              </span>
              <span className="sm:hidden">
                {importingFromServer ? "Đang nhập..." : "Nhập"}
              </span>
            </button>
            <button
              type="button"
              disabled={sendingToServer || importingFromServer}
              onClick={() => void handleSendToServer()}
              title="Gửi các chỉnh sửa (vi phạm, điểm, thông báo...) lên máy chủ để các tài khoản khác thấy"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {sendingToServer ? "Đang gửi..." : "Gửi về máy chủ"}
              </span>
              <span className="sm:hidden">
                {sendingToServer ? "Đang gửi..." : "Gửi"}
              </span>
            </button>
            <div className="hidden sm:grid w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary-soft-ink)] place-items-center text-xs font-extrabold shrink-0">
              {avatarCode}
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-sm font-bold truncate max-w-[160px] lg:max-w-[200px]">
                {displayName}
              </div>
              <div className="text-xs text-[var(--muted)] truncate max-w-[160px] lg:max-w-[220px]">
                {displayRole}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--panel-subtle)] transition-colors cursor-pointer whitespace-nowrap"
            >
              Thoát
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-7 max-w-[1400px] w-full mx-auto">
          <DashboardPages
            page={page}
            db={db}
            session={session}
            onNavigate={handleNavigate}
            onUpdateDb={handleUpdateDb}
            onToast={showToast}
            onOpenModal={setModal}
            onImportFromServer={handleImportFromServer}
            importingFromServer={importingFromServer}
            onSendToServer={handleSendToServer}
            sendingToServer={sendingToServer}
          />
        </main>

        <footer className="text-center text-xs text-[var(--muted)] py-4 px-4">
          © 2026 {db.className} · Đoàn kết là sức mạnh
        </footer>
      </div>

      <ModalDialog modal={modal} onClose={() => setModal(null)} />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#10254b] text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-xl border border-white/10"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
