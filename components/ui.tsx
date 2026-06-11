"use client";

import { ReactNode } from "react";
import { scoreBand } from "@/lib/rubric";
import type { Tier } from "@/lib/types";

export function ScorePill({ label, score }: { label?: string; score: number }) {
  const band = scoreBand(score);
  const cls = {
    green: "bg-success-light text-success-text dark:bg-[#14532D] dark:text-[#86EFAC]",
    amber: "bg-warning-light text-warning-text dark:bg-[#78350F] dark:text-[#FCD34D]",
    red: "bg-danger-light text-danger-text dark:bg-[#7F1D1D] dark:text-[#FCA5A5]",
    skipped: "bg-light-bg text-light-text3 dark:bg-dark-surface3 dark:text-dark-text3",
  }[band];
  const text = score < 0 ? "—" : String(score);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label ? `${label}: ${text}` : text}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const cls = {
    critical: "bg-danger-light text-danger-text dark:bg-[#7F1D1D] dark:text-[#FCA5A5]",
    major: "bg-warning-light text-warning-text dark:bg-[#78350F] dark:text-[#FCD34D]",
    minor: "bg-light-bg text-light-text3 dark:bg-dark-surface3 dark:text-dark-text3",
  }[tier];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {tier}
    </span>
  );
}

export function Section({
  step,
  title,
  subtitle,
  done,
  children,
  id,
}: {
  step: number;
  title: string;
  subtitle?: string;
  done?: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 rounded-xl border border-light-border bg-light-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-dark-border dark:bg-dark-surface dark:shadow-[0_1px_4px_rgba(0,0,0,0.20)]"
    >
      <header className="flex items-center gap-3 border-b border-light-border px-6 py-4 dark:border-dark-border">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? "bg-success-light text-success-text" : "bg-brand text-white"
          }`}
        >
          {done ? "✓" : step}
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-light-text dark:text-dark-text">{title}</h2>
          {subtitle && <p className="text-xs text-light-text2 dark:text-dark-text2">{subtitle}</p>}
        </div>
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-50",
    secondary:
      "border border-brand bg-transparent text-brand hover:bg-brand-light dark:hover:bg-brand/10 disabled:opacity-50",
    ghost:
      "text-light-text2 hover:bg-light-surface2 dark:text-dark-text2 dark:hover:bg-dark-surface2 disabled:opacity-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "pass" | "fail" | "neutral" | "warn" | "generated";
  children: ReactNode;
}) {
  const styles = {
    pass: "bg-success-light text-success-text dark:bg-[#14532D] dark:text-[#86EFAC]",
    fail: "bg-danger-light text-danger-text dark:bg-[#7F1D1D] dark:text-[#FCA5A5]",
    neutral: "bg-light-bg text-light-text3 dark:bg-dark-surface2 dark:text-dark-text3",
    warn: "bg-warning-light text-warning-text dark:bg-[#78350F] dark:text-[#FCD34D]",
    generated: "bg-brand-light text-brand dark:bg-[#1E3A5F] dark:text-[#93C5FD]",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
