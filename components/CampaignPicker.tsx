"use client";

import { useEffect, useState } from "react";
import { CampaignRecord } from "@/lib/types";
import { Spinner } from "./ui";

const NEW_OPTION = "__new__";

export function CampaignPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/campaigns");
        const data = await res.json();
        if (active) setCampaigns(data.campaigns ?? []);
      } catch {
        // leave empty; user can still create a new one
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveNewCampaign() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      const campaign: CampaignRecord | undefined = data.campaign;
      if (campaign) {
        setCampaigns((prev) =>
          prev.some((c) => c.id === campaign.id) ? prev : [campaign, ...prev]
        );
        onChange(campaign.name);
      } else {
        onChange(name);
      }
      setNewName("");
      setMode("select");
    } catch {
      // fall back to using the typed name locally
      onChange(name);
      setMode("select");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <span className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading campaigns…
      </span>
    );
  }

  if (mode === "new") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={disabled || saving}
          autoFocus
          placeholder="New campaign name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveNewCampaign();
            }
          }}
        />
        <button
          type="button"
          onClick={saveNewCampaign}
          disabled={disabled || saving || !newName.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? <Spinner /> : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("select");
            setNewName("");
          }}
          disabled={saving}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        if (e.target.value === NEW_OPTION) setMode("new");
        else onChange(e.target.value);
      }}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50"
    >
      <option value="" disabled>
        Select a campaign…
      </option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
      <option value={NEW_OPTION}>＋ New campaign</option>
    </select>
  );
}
