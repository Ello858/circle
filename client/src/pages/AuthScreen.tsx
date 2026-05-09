import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../api";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "register" | "reset";

type RegStatus = { open: boolean; userCount: number; maxUsers: number } | null;

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [status, setStatus] = useState<RegStatus>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetKey, setResetKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .registrationStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus({ open: false, userCount: 0, maxUsers: 10 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSuccess(null);
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await register(
        username.trim(),
        password,
        displayName.trim() || undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== newPasswordConfirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.resetPassword({
        username: username.trim(),
        reset_key: resetKey,
        new_password: newPassword,
      });
      setSuccess("Password reset! You can sign in now.");
      setResetKey("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  const regOpen = status?.open ?? false;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-app-bg px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-app-sidebar p-8 shadow-glow-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
          {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Reset password"}
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Private circle — max {status?.maxUsers ?? 10} people, all local.{" "}
          {status != null ? (
            <>
              ({status.userCount}/{status.maxUsers} joined
              {!regOpen ? " — full" : ""}.)
            </>
          ) : null}
        </p>

        {mode !== "reset" && (
          <div className="mt-6 flex rounded-xl bg-app-chat p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-app-bubbleOut text-white shadow-glow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={!regOpen}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "register"
                  ? "bg-app-bubbleOut text-white shadow-glow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => {
                if (!regOpen) return;
                switchMode("register");
              }}
            >
              Register
            </button>
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={onLogin} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Username</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-app-bubbleOut py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
              >
                Forgot password?
              </button>
            </p>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={onRegister} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Username</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                title="Letters, numbers, underscore only"
              />
              <p className="mt-1 text-[11px] text-zinc-600">
                3–32 chars: letters, numbers, underscore. Stored lowercase.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">
                Display name <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                placeholder="How you appear in chat"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
              />
              <p className="mt-1 text-[11px] text-zinc-600">At least 10 characters.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Confirm password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={10}
              />
            </div>
            {error ? (
              <p className="text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || !regOpen}
              className="w-full rounded-xl bg-app-bubbleOut py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={onReset} className="mt-8 space-y-4">
            <p className="text-center text-xs text-zinc-500">
              DM the admin for the reset key, then fill this out.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Username</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Reset key</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                value={resetKey}
                onChange={(e) => setResetKey(e.target.value)}
                required
                placeholder="The key from the admin"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">New password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={10}
              />
              <p className="mt-1 text-[11px] text-zinc-600">At least 10 characters.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Confirm new password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-app-chat px-3 py-2.5 text-sm text-white outline-none ring-indigo-500/40 transition focus:border-indigo-500 focus:ring-2"
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                required
                minLength={10}
              />
            </div>
            {error ? (
              <p className="text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-center text-sm text-emerald-400" role="status">
                {success}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-app-bubbleOut py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Reset password"}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}

        {!regOpen && status != null && mode === "login" ? (
          <p className="mt-6 text-center text-xs text-zinc-500">
            New accounts are closed — this circle already has {status.maxUsers} members. Use an
            existing username, or reset the server database to start fresh.
          </p>
        ) : null}
      </div>
    </div>
  );
}
