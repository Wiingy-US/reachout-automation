"use client";

import { useEffect, useState } from "react";
import { UserRecord } from "@/lib/types";
import { Spinner } from "./ui";

const NEW_OPTION = "__new__";

export function UserPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (active) setUsers(data.users ?? []);
      } catch {
        /* leave empty; user can still add */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveNewUser() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      const user: UserRecord | undefined = data.user;
      if (user) {
        setUsers((prev) => (prev.some((u) => u.id === user.id) ? prev : [user, ...prev]));
        onChange(user.name);
      } else {
        onChange(name);
      }
      setNewName("");
      setMode("select");
    } catch {
      onChange(name);
      setMode("select");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />;
  }

  if (mode === "new") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={disabled || saving}
          autoFocus
          placeholder="New user name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveNewUser();
            }
          }}
        />
        <button
          type="button"
          onClick={saveNewUser}
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
        Select your name…
      </option>
      {users.map((u) => (
        <option key={u.id} value={u.name}>
          {u.name}
        </option>
      ))}
      <option value={NEW_OPTION}>＋ Add user</option>
    </select>
  );
}
