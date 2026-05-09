import { useState } from "react";
import type { User } from "../types";
import { apiClient } from "../api";

type Props = {
  users: User[];
  onClose: () => void;
  onRefresh: () => void;
};

type EditMode = "reset-pw" | "edit-profile" | null;

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export default function AdminPanel({ users, onClose, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [editTarget, setEditTarget] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [newPw, setNewPw] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const adminUser = users.find((u) => u.username === "admin");
  const nonAdminUsers = users.filter((u) => u.username !== "admin");
  const [selfEditing, setSelfEditing] = useState(false);
  const [selfDisplayName, setSelfDisplayName] = useState(adminUser?.display_name ?? "Admin");

  function openEdit(userId: number, mode: EditMode, user: User) {
    setError(null);
    setSuccess(null);
    if (editTarget === userId && editMode === mode) {
      setEditTarget(null);
      setEditMode(null);
      return;
    }
    setEditTarget(userId);
    setEditMode(mode);
    setNewPw("");
    setNewUsername(user.username);
    setNewDisplayName(user.display_name);
    setDeleteTarget(null);
  }

  async function handleSelfDisplayName() {
    if (!adminUser) return;
    const clean = selfDisplayName.trim();
    if (!clean || clean.length > 30) { setError("Display name must be 1-30 characters."); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.adminUpdateUser(adminUser.id, { display_name: clean });
      setSuccess("Display name updated.");
      setSelfEditing(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handlePurgeAll() {
    if (!purgeConfirm) { setPurgeConfirm(true); return; }
    setBusy(true); setError(null);
    try {
      const r = await apiClient.adminPurgeAll();
      setSuccess(`Purged ${r.deleted} messages.`);
      setPurgeConfirm(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleResetPassword(userId: number) {
    if (!newPw || newPw.length < 10) { setError("Password must be at least 10 characters."); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.adminResetPassword(userId, newPw);
      setSuccess("Password reset.");
      setEditTarget(null); setEditMode(null); setNewPw("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleUpdateProfile(userId: number) {
    const fields: { username?: string; display_name?: string } = {};
    const trimU = newUsername.trim();
    const trimD = newDisplayName.trim();
    if (trimU) fields.username = trimU;
    if (trimD) fields.display_name = trimD;
    if (!trimU && !trimD) { setError("Enter a username or display name."); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.adminUpdateUser(userId, fields);
      setSuccess("Profile updated.");
      setEditTarget(null); setEditMode(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleDeleteUser(userId: number) {
    if (deleteTarget !== userId) { setDeleteTarget(userId); setEditTarget(null); setEditMode(null); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.adminDeleteUser(userId);
      setSuccess("Account deleted.");
      setDeleteTarget(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-indigo-500/30 bg-zinc-900 p-6 shadow-glow max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400">
            <ShieldIcon />
            <h2 className="font-semibold text-white">Admin Panel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            Close
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        {success && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{success}</p>}

        {adminUser && (
          <div className="rounded-xl border border-indigo-500/20 bg-zinc-800/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your Profile</p>
              <button
                type="button"
                onClick={() => { setSelfEditing((v) => !v); setError(null); setSuccess(null); setSelfDisplayName(adminUser.display_name); }}
                className={`rounded-lg px-2 py-1 text-[11px] transition ${selfEditing ? "bg-indigo-500/20 text-indigo-300" : "text-indigo-400 hover:bg-indigo-500/10"}`}
              >
                {selfEditing ? "Cancel" : "Edit"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: adminUser.avatar_color }}
              >
                {adminUser.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{adminUser.display_name}</p>
                <p className="text-[11px] text-zinc-500">@{adminUser.username}</p>
              </div>
            </div>
            {selfEditing && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="New display name"
                  value={selfDisplayName}
                  onChange={(e) => setSelfDisplayName(e.target.value)}
                  maxLength={30}
                  className="flex-1 rounded-xl border border-zinc-700 bg-app-chat px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/30"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSelfDisplayName}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Global Actions</p>
          <button
            type="button"
            disabled={busy}
            onClick={handlePurgeAll}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              purgeConfirm
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
            }`}
          >
            {purgeConfirm ? "Tap again to confirm — wipes EVERYTHING" : "Purge All Chats"}
          </button>
          {purgeConfirm && (
            <button
              type="button"
              onClick={() => setPurgeConfirm(false)}
              className="mt-2 w-full text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Members</p>
          {nonAdminUsers.length === 0 ? (
            <p className="text-sm text-zinc-600">No members yet.</p>
          ) : (
            <ul className="space-y-3">
              {nonAdminUsers.map((u) => (
                <li key={u.id} className="rounded-xl border border-zinc-700/50 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{u.display_name}</p>
                        <p className="truncate text-[11px] text-zinc-500">@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 ml-2">
                      <button
                        type="button"
                        onClick={() => openEdit(u.id, "edit-profile", u)}
                        className={`rounded-lg px-2 py-1 text-[11px] transition ${
                          editTarget === u.id && editMode === "edit-profile"
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "text-indigo-400 hover:bg-indigo-500/10"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(u.id, "reset-pw", u)}
                        className={`rounded-lg px-2 py-1 text-[11px] transition ${
                          editTarget === u.id && editMode === "reset-pw"
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "text-indigo-400 hover:bg-indigo-500/10"
                        }`}
                      >
                        Reset PW
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteUser(u.id)}
                        className={`rounded-lg px-2 py-1 text-[11px] transition disabled:opacity-50 ${
                          deleteTarget === u.id
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "text-zinc-500 hover:bg-zinc-700 hover:text-white"
                        }`}
                      >
                        {deleteTarget === u.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {editTarget === u.id && editMode === "edit-profile" && (
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="New username (3-20 chars)"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/30"
                      />
                      <input
                        type="text"
                        placeholder="New display name"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/30"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleUpdateProfile(u.id)}
                        className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
                      >
                        Save Changes
                      </button>
                    </div>
                  )}

                  {editTarget === u.id && editMode === "reset-pw" && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="password"
                        placeholder="New password (10+ chars)"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-700 bg-app-chat px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/30"
                        minLength={10}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleResetPassword(u.id)}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
                      >
                        Set
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
