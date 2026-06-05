"use client";

import { DataFactRow } from "@/lib/types";
import { FACT_CATEGORIES } from "@/lib/dataFacts";

export function DataFactsTable({
  rows,
  onChange,
  disabled,
}: {
  rows: DataFactRow[];
  onChange: (rows: DataFactRow[]) => void;
  disabled?: boolean;
}) {
  function update(i: number, patch: Partial<DataFactRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function addRow() {
    onChange([...rows, { stat: "", category: "Other", source: "" }]);
  }

  const cellInput =
    "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-300 focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60";

  return (
    <div>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Stat / Finding</th>
              <th className="w-40 px-2 py-2">Category</th>
              <th className="w-56 px-2 py-2">Source / Context</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">
                  No data facts yet. Add a row to enter one manually.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                <td className="px-2 py-1 align-top text-xs text-slate-400">{i + 1}</td>
                <td className="px-2 py-1 align-top">
                  <textarea
                    value={row.stat}
                    onChange={(e) => update(i, { stat: e.target.value })}
                    disabled={disabled}
                    rows={1}
                    placeholder="e.g. 67% of Americans listen to music daily"
                    className={`${cellInput} resize-y`}
                  />
                </td>
                <td className="px-2 py-1 align-top">
                  <select
                    value={row.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                    disabled={disabled}
                    className={cellInput}
                  >
                    {FACT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1 align-top">
                  <input
                    value={row.source}
                    onChange={(e) => update(i, { source: e.target.value })}
                    disabled={disabled}
                    placeholder="e.g. Section 2, survey of 5,000 adults"
                    className={cellInput}
                  />
                </td>
                <td className="px-2 py-1 align-top text-center">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={disabled}
                    aria-label="Delete row"
                    className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="text-xs font-medium text-brand hover:text-brand-dark disabled:opacity-40"
        >
          + Add row
        </button>
        <span className="text-xs text-slate-400">
          {rows.filter((r) => r.stat.trim()).length} fact(s) — used as ground truth for the quality check (MAIN-01).
        </span>
      </div>
    </div>
  );
}
