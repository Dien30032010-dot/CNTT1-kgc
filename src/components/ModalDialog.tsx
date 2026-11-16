import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type ModalConfig =
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      onConfirm: () => void;
    }
  | {
      type: "input";
      title: string;
      label: string;
      initialValue: string;
      placeholder?: string;
      inputType?: "text" | "number" | "textarea";
      min?: number;
      max?: number;
      step?: string;
      confirmLabel?: string;
      onSubmit: (value: string) => boolean | void;
    };

interface ModalDialogProps {
  modal: ModalConfig | null;
  onClose: () => void;
}

export function ModalDialog({ modal, onClose }: ModalDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (modal?.type === "input") {
      setValue(modal.initialValue);
    }
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, onClose]);

  if (!modal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modal.type === "confirm") {
      modal.onConfirm();
      onClose();
      return;
    }
    const result = modal.onSubmit(value);
    if (result !== false) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-[#07152b]/70 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--panel)] border border-[var(--line)] p-6 shadow-2xl text-[var(--ink)]">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 id="modal-title" className="text-lg font-bold">
            {modal.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {modal.type === "confirm" ? (
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
              {modal.message}
            </p>
          ) : (
            <div className="mb-5">
              <label className="block text-[13px] font-semibold mb-1.5">
                {modal.label}
              </label>
              {modal.inputType === "textarea" ? (
                <textarea
                  autoFocus
                  rows={3}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={modal.placeholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              ) : (
                <input
                  autoFocus
                  type={modal.inputType ?? "text"}
                  min={modal.min}
                  max={modal.max}
                  step={modal.step}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={modal.placeholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--line)] bg-transparent text-[var(--ink)] text-sm font-semibold hover:bg-[var(--panel-subtle)] transition-colors cursor-pointer whitespace-nowrap"
            >
              Hủy
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                modal.type === "confirm" && modal.danger
                  ? "bg-[#e34d5b] hover:bg-[#c83c49]"
                  : "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
              }`}
            >
              {modal.confirmLabel ?? "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
