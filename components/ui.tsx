"use client";

import { ReactNode } from "react";

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
      className="scroll-mt-4 rounded-xl border border-wiingy-gray-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
    >
      <header className="flex items-center gap-3 border-b border-wiingy-gray-border px-6 py-4">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? "bg-wiingy-green-light text-wiingy-green" : "bg-wiingy-blue text-white"
          }`}
        >
          {done ? "✓" : step}
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-wiingy-dark">{title}</h2>
          {subtitle && <p className="text-xs text-wiingy-gray">{subtitle}</p>}
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
    primary: "bg-wiingy-blue text-white hover:bg-wiingy-blue-dark disabled:bg-[#A5ADDB]",
    secondary:
      "border border-wiingy-blue bg-white text-wiingy-blue hover:bg-wiingy-blue-light disabled:opacity-50",
    ghost: "text-wiingy-gray hover:bg-wiingy-gray-light disabled:opacity-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "pass" | "fail" | "neutral" | "warn";
  children: ReactNode;
}) {
  const styles = {
    pass: "bg-wiingy-green-light text-[#15803D]",
    fail: "bg-wiingy-red-light text-[#DC2626]",
    neutral: "bg-wiingy-gray-light text-[#9CA3AF]",
    warn: "bg-wiingy-amber-light text-[#B45309]",
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
