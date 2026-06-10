"use client";

import { useState } from "react";
import {
  Settings,
  Users,
  Zap,
  CheckSquare,
  Download,
  Check,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

export interface SessionStats {
  journalists: string;
  generated: string;
  passRate: string;
  cost: string;
}

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: "Campaign Setup", icon: Settings },
  { label: "Journalists", icon: Users },
  { label: "Generate", icon: Zap },
  { label: "Review & QC", icon: CheckSquare },
  { label: "Export", icon: Download },
];

export function Sidebar({
  currentStep,
  completedSteps,
  activeTab,
  onTabChange,
  onStepClick,
  sessionStats,
  isDark,
  onToggleDark,
}: {
  currentStep: number;
  completedSteps: boolean[];
  activeTab: "generate" | "dashboard";
  onTabChange: (t: "generate" | "dashboard") => void;
  onStepClick: (index: number) => void;
  sessionStats: SessionStats;
  isDark: boolean;
  onToggleDark: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const anyComplete = completedSteps.some(Boolean);

  return (
    <aside
      className={`flex h-screen flex-shrink-0 flex-col border-r border-light-border bg-light-surface transition-[width] duration-200 dark:border-dark-border dark:bg-dark-surface ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* A. Header */}
      <div className="flex items-center justify-between px-4 py-4">
        {isCollapsed ? (
          <span className="mx-auto text-xl font-bold text-brand">W</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold text-brand">Wiingy</span>
            <span className="h-4 w-px bg-light-border dark:bg-dark-border" />
            <span className="text-[18px] font-semibold text-light-text dark:text-dark-text">Reachout</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`mb-2 flex items-center px-4 py-1 text-light-text3 hover:text-light-text2 dark:text-dark-text3 dark:hover:text-dark-text2 ${
          isCollapsed ? "justify-center" : "justify-end"
        }`}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* B. Step tracker */}
      <div className="flex-1 overflow-y-auto px-4">
        {!isCollapsed && (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-light-text3 dark:text-dark-text3">
            Steps
          </p>
        )}
        <div>
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps[index];
            const isCurrent = index === currentStep && !isCompleted;
            const StepIcon = step.icon;
            const clickable = index <= currentStep || isCompleted;
            return (
              <div key={step.label} className="relative flex items-start gap-3 py-2">
                {index < STEPS.length - 1 && (
                  <div className="absolute left-[19px] top-[36px] h-[calc(100%-8px)] w-[2px] bg-light-border dark:bg-dark-border">
                    {isCompleted && <div className="h-full w-full bg-brand" />}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => clickable && onStepClick(index)}
                  disabled={!clickable}
                  className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    clickable ? "cursor-pointer" : "cursor-default"
                  } ${
                    isCompleted
                      ? "bg-brand text-white"
                      : isCurrent
                      ? "bg-brand text-white ring-4 ring-brand/20 animate-pulse"
                      : "bg-light-surface2 text-light-text3 dark:bg-dark-surface2 dark:text-dark-text3"
                  }`}
                  title={step.label}
                >
                  {isCompleted ? <Check size={14} /> : <StepIcon size={14} />}
                </button>
                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={() => clickable && onStepClick(index)}
                    disabled={!clickable}
                    className="pt-1 text-left disabled:cursor-default"
                  >
                    <p
                      className={`text-sm font-medium leading-tight ${
                        isCurrent
                          ? "text-brand"
                          : isCompleted
                          ? "text-light-text dark:text-dark-text"
                          : "text-light-text3 dark:text-dark-text3"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="mt-0.5 text-xs text-light-text3 dark:text-dark-text3">In progress</p>
                    )}
                    {isCompleted && <p className="mt-0.5 text-xs text-success-text">Complete</p>}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* C. Session stats */}
        {!isCollapsed && anyComplete && (
          <div className="mt-6">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-light-text3 dark:text-dark-text3">
              This Session
            </p>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <span className="text-light-text2 dark:text-dark-text2">Journalists</span>
              <span className="text-right font-semibold text-light-text dark:text-dark-text">{sessionStats.journalists}</span>
              <span className="text-light-text2 dark:text-dark-text2">Generated</span>
              <span className="text-right font-semibold text-light-text dark:text-dark-text">{sessionStats.generated}</span>
              <span className="text-light-text2 dark:text-dark-text2">QC Pass Rate</span>
              <span className="text-right font-semibold text-light-text dark:text-dark-text">{sessionStats.passRate}</span>
              <span className="text-light-text2 dark:text-dark-text2">Est. Cost</span>
              <span className="text-right font-semibold text-light-text dark:text-dark-text">{sessionStats.cost}</span>
            </div>
          </div>
        )}
      </div>

      {/* D. Dashboard link */}
      <div className="border-t border-light-border px-3 py-3 dark:border-dark-border">
        <button
          type="button"
          onClick={() => onTabChange("dashboard")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ${
            activeTab === "dashboard"
              ? "bg-brand-light text-brand dark:bg-brand/10"
              : "text-light-text2 hover:bg-light-surface2 dark:text-dark-text2 dark:hover:bg-dark-surface2"
          } ${isCollapsed ? "justify-center" : ""}`}
          title="Dashboard"
        >
          <BarChart2 size={18} />
          {!isCollapsed && <span className="text-sm font-medium">Dashboard</span>}
        </button>
        {activeTab === "dashboard" && (
          <button
            type="button"
            onClick={() => onTabChange("generate")}
            className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-light-text2 transition-colors duration-150 hover:bg-light-surface2 dark:text-dark-text2 dark:hover:bg-dark-surface2 ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Generate"
          >
            <Zap size={18} />
            {!isCollapsed && <span className="text-sm font-medium">Generate</span>}
          </button>
        )}
      </div>

      {/* E. Footer */}
      <div className="border-t border-light-border px-3 py-3 dark:border-dark-border">
        <button
          type="button"
          onClick={onToggleDark}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-light-text2 transition-colors hover:bg-light-surface2 dark:text-dark-text2 dark:hover:bg-dark-surface2 ${
            isCollapsed ? "justify-center" : ""
          }`}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {!isCollapsed && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
        </button>
        {!isCollapsed && (
          <p className="mt-2 px-3 text-[11px] text-light-text3 dark:text-dark-text3">v1.0 · Wiingy Reachout</p>
        )}
      </div>
    </aside>
  );
}
