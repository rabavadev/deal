"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIES, type Tool } from "@/lib/tools";

/* ── Config ─────────────────────────────────────────────────────── */
// sha256 of the admin password. Default password: deal2026
// Change it: echo -n "newpassword" | sha256sum  → paste hash below.
const PASSWORD_HASH =
  "2bb4bb2bf7ba5003f4d24c809bdf2b96bb6c74fcdc655fdbe560a53cf1299863";
const REPO = "rabavadev/deal";
const BRANCH = "main";
const FILE_PATH = "lib/tools-data.json";

const EMPTY_TOOL: Tool = {
  slug: "",
  name: "",
  emoji: "🤖",
  tagline: "",
  offer: "",
  offerValue: "",
  category: "AI Chatbots",
  featured: false,
  affiliateUrl: "",
  description: "",
  steps: [],
  terms: "",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Status = { kind: "idle" | "loading" | "saving" | "ok" | "error"; msg?: string };

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);

  const [token, setToken] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [fileSha, setFileSha] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Tool | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* ── auth ── */
  useEffect(() => {
    if (sessionStorage.getItem("deal_admin_auth") === "1") setAuthed(true);
    const t = localStorage.getItem("deal_admin_gh_token");
    if (t) setToken(t);
  }, []);

  const tryLogin = async () => {
    const h = await sha256(password);
    if (h === PASSWORD_HASH) {
      sessionStorage.setItem("deal_admin_auth", "1");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  /* ── github api ── */
  const gh = useCallback(
    async (path: string, init?: RequestInit) => {
      const r = await fetch(`https://api.github.com${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
      return r.json();
    },
    [token]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setStatus({ kind: "loading", msg: "Loading deals from GitHub…" });
    try {
      const data = await gh(`/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
      const parsed = JSON.parse(fromBase64Utf8(data.content)) as Tool[];
      setTools(parsed);
      setFileSha(data.sha);
      setDirty(false);
      setStatus({ kind: "ok", msg: `Loaded ${parsed.length} deals` });
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }, [gh, token]);

  useEffect(() => {
    if (authed && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const save = async () => {
    setStatus({ kind: "saving", msg: "Committing to GitHub…" });
    try {
      const content = toBase64Utf8(JSON.stringify(tools, null, 2) + "\n");
      const res = await gh(`/repos/${REPO}/contents/${FILE_PATH}`, {
        method: "PUT",
        body: JSON.stringify({
          message: "Update deals via admin panel",
          content,
          sha: fileSha,
          branch: BRANCH,
        }),
      });
      setFileSha(res.content.sha);
      setDirty(false);
      setStatus({ kind: "ok", msg: "Saved! Homepage updates instantly; offer pages go live on next deploy." });
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  /* ── editing ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) =>
      [t.name, t.tagline, t.offer, t.category].join(" ").toLowerCase().includes(q)
    );
  }, [tools, search]);

  const openEdit = (t: Tool) => {
    setEditing({ ...t, steps: [...t.steps] });
    setIsNew(false);
  };
  const openNew = () => {
    setEditing({ ...EMPTY_TOOL });
    setIsNew(true);
  };
  const commitEdit = () => {
    if (!editing) return;
    const t = { ...editing, slug: editing.slug || slugify(editing.name) };
    if (!t.slug || !t.name) return;
    if (isNew) {
      if (tools.some((x) => x.slug === t.slug)) {
        alert("A deal with this slug already exists.");
        return;
      }
      setTools([t, ...tools]);
    } else {
      setTools(tools.map((x) => (x.slug === editing.slug ? t : x)));
    }
    setEditing(null);
    setDirty(true);
  };
  const remove = (slug: string) => {
    if (!confirm(`Delete "${slug}"? Remember to Save after.`)) return;
    setTools(tools.filter((t) => t.slug !== slug));
    setDirty(true);
  };

  /* ── render: login gate ── */
  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the admin password.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryLogin()}
          placeholder="Password"
          className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {pwError && <p className="mt-2 text-sm text-red-400">Wrong password.</p>}
        <button
          onClick={tryLogin}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Log in
        </button>
      </div>
    );
  }

  /* ── render: token setup ── */
  if (!token) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
        <h1 className="text-2xl font-bold">Connect GitHub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a GitHub token with repo access to {REPO}. It stays in this browser only
          (localStorage) and is used to save your edits as commits.
        </p>
        <TokenForm
          onSave={(t) => {
            localStorage.setItem("deal_admin_gh_token", t);
            setToken(t);
          }}
        />
      </div>
    );
  }

  /* ── render: dashboard ── */
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div>
          <h1 className="text-2xl font-bold">Deals dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {tools.length} deals · {dirty ? "unsaved changes" : "all saved"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/50"
          >
            Reload
          </button>
          <button
            onClick={openNew}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/50"
          >
            + New deal
          </button>
          <button
            onClick={save}
            disabled={!dirty || status.kind === "saving"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {status.kind === "saving" ? "Saving…" : "Save to GitHub"}
          </button>
        </div>
      </div>

      {status.msg && (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            status.kind === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : status.kind === "ok"
                ? "border-green-500/40 bg-green-500/10 text-green-300"
                : "border-border bg-card text-muted-foreground"
          }`}
        >
          {status.msg}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search deals…"
        className="mt-4 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="mt-4 divide-y divide-border rounded-md border border-border">
        {filtered.map((t) => (
          <div key={t.slug} className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-xl">{t.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{t.name}</span>
                {t.featured && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Featured
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {t.category} · {t.offer}
              </p>
            </div>
            <button
              onClick={() => openEdit(t)}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/50"
            >
              Edit
            </button>
            <button
              onClick={() => remove(t.slug)}
              className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No deals found.</p>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Token stored in this browser only.{" "}
        <button
          className="underline hover:text-foreground"
          onClick={() => {
            localStorage.removeItem("deal_admin_gh_token");
            setToken("");
          }}
        >
          Reset GitHub token
        </button>
      </p>

      {editing && (
        <EditModal
          tool={editing}
          isNew={isNew}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={commitEdit}
        />
      )}
    </div>
  );
}

function TokenForm({ onSave }: { onSave: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="ghp_… / github_pat_…"
        className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        onClick={() => v.trim() && onSave(v.trim())}
        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Save token
      </button>
    </>
  );
}

function EditModal({
  tool,
  isNew,
  onChange,
  onClose,
  onSave,
}: {
  tool: Tool;
  isNew: boolean;
  onChange: (t: Tool) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Tool>(k: K, v: Tool[K]) => onChange({ ...tool, [k]: v });
  const input =
    "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-lg border border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{isNew ? "New deal" : `Edit: ${tool.name}`}</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Name *</label>
            <input className={input} value={tool.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={label}>Slug (URL) — auto from name if empty</label>
            <input className={input} value={tool.slug} onChange={(e) => set("slug", e.target.value)} />
          </div>
          <div>
            <label className={label}>Emoji</label>
            <input className={input} value={tool.emoji} onChange={(e) => set("emoji", e.target.value)} />
          </div>
          <div>
            <label className={label}>Category</label>
            <select
              className={input}
              value={tool.category}
              onChange={(e) => set("category", e.target.value as Tool["category"])}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Tagline</label>
            <input className={input} value={tool.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </div>
          <div>
            <label className={label}>Offer (card banner text)</label>
            <input className={input} value={tool.offer} onChange={(e) => set("offer", e.target.value)} />
          </div>
          <div>
            <label className={label}>Offer badge (e.g. "$100 free")</label>
            <input
              className={input}
              value={tool.offerValue ?? ""}
              onChange={(e) => set("offerValue", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Affiliate URL — your money link</label>
            <input
              className={input}
              value={tool.affiliateUrl}
              onChange={(e) => set("affiliateUrl", e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description</label>
            <textarea
              className={input}
              rows={3}
              value={tool.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Steps to claim (one per line)</label>
            <textarea
              className={input}
              rows={4}
              value={tool.steps.join("\n")}
              onChange={(e) => set("steps", e.target.value.split("\n").filter((s) => s.trim()))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Terms (optional)</label>
            <textarea
              className={input}
              rows={2}
              value={tool.terms ?? ""}
              onChange={(e) => set("terms", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!tool.featured}
              onChange={(e) => set("featured", e.target.checked)}
            />
            Featured deal
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:border-primary/50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!tool.name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {isNew ? "Add deal" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
