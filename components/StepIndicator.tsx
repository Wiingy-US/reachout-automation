"use client";

const STEPS = ["Campaign Setup", "Upload Journalists", "Generate", "Review", "Export"];

/** Horizontal wizard progress indicator. `current` is the 0-based active step. */
export function StepIndicator({ current }: { current: number }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-emerald-100 text-emerald-700"
                  : active
                  ? "bg-brand text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`${
                active ? "font-semibold text-slate-900" : done ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="px-1 text-slate-300">→</span>}
          </div>
        );
      })}
    </nav>
  );
}
