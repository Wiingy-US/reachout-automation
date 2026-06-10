"use client";

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Yes, go back",
  cancelLabel = "Keep results",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl bg-light-surface p-7 shadow-[0_20px_60px_rgba(0,0,0,0.20)] dark:bg-dark-surface"
      >
        <h3 className="text-[17px] font-semibold text-light-text dark:text-dark-text">{title}</h3>
        <p className="mt-2 text-sm text-light-text2 dark:text-dark-text2">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-brand px-5 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-light dark:hover:bg-brand/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-light dark:hover:bg-danger/10"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
