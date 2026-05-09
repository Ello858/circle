const TOKEN_KEY = "pm_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token: tokenOverride, ...fetchOpts } = options;
  const token = tokenOverride !== undefined ? tokenOverride : getToken();
  const headers: HeadersInit = {
    ...(fetchOpts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...((fetchOpts.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...fetchOpts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  registrationStatus() {
    return api<{ open: boolean; userCount: number; maxUsers: number }>(
      "/api/registration/status",
      { token: null }
    );
  },
  register(body: { username: string; password: string; display_name?: string }) {
    return api<{ token: string; user: import("./types").User }>("/api/register", {
      method: "POST",
      body: JSON.stringify(body),
      token: null,
    });
  },
  login(body: { username: string; password: string }) {
    return api<{ token: string; user: import("./types").User }>("/api/login", {
      method: "POST",
      body: JSON.stringify(body),
      token: null,
    });
  },
  me() {
    return api<import("./types").User>("/api/me");
  },
  users() {
    return api<import("./types").User[]>("/api/users");
  },
  conversations() {
    return api<import("./types").Conversation[]>("/api/conversations");
  },
  messages(conversationId: number, before?: number) {
    const q = before ? `?before=${before}` : "";
    return api<{
      messages: import("./types").MessageRow[];
      dm_peer_read_up_to: number | null;
    }>(`/api/conversations/${conversationId}/messages${q}`);
  },
  read(conversationId: number, messageId?: number) {
    return api<{ ok: boolean; last_read_message_id: number | null }>(
      `/api/conversations/${conversationId}/read`,
      {
        method: "POST",
        body: JSON.stringify(messageId ? { message_id: messageId } : {}),
      }
    );
  },
  adminUpdateUser(userId: number, fields: { username?: string; display_name?: string }) {
    return api<{ ok: boolean }>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  },
  adminPurgeAll() {
    return api<{ ok: boolean; deleted: number }>("/api/admin/purge-all", { method: "POST" });
  },
  adminResetPassword(userId: number, newPassword: string) {
    return api<{ ok: boolean }>("/api/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({ userId, newPassword }),
    });
  },
  adminDeleteUser(userId: number) {
    return api<{ ok: boolean }>(`/api/admin/users/${userId}`, { method: "DELETE" });
  },
  resetPassword(body: { username: string; reset_key: string; new_password: string }) {
    return api<{ ok: boolean }>("/api/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
      token: null,
    });
  },
  uploadImage(file: File) {
    const fd = new FormData();
    fd.append("image", file);
    return api<{ url: string }>("/api/upload", {
      method: "POST",
      body: fd,
    });
  },
};
