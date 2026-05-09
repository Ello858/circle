import type { Conversation, User } from "../types";
import { formatListTime } from "../utils/format";

type Props = {
  user: User;
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onlineIds: Set<number>;
  onLogout: () => void;
  onOpenAdmin?: () => void;
};

function Avatar({
  label,
  color,
  online,
  size = "md",
}: {
  label: string;
  color: string;
  online?: boolean;
  size?: "md" | "sm";
}) {
  const sz = size === "md" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  return (
    <div className="relative shrink-0">
      <div
        className={`flex ${sz} items-center justify-center rounded-full font-semibold text-white`}
        style={{ backgroundColor: color }}
      >
        {label.slice(0, 2).toUpperCase()}
      </div>
      {online !== undefined ? (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-app-sidebar ${
            online ? "bg-emerald-500" : "bg-zinc-600"
          }`}
          title={online ? "Online" : "Offline"}
        />
      ) : null}
    </div>
  );
}

export default function Sidebar({
  user,
  conversations,
  selectedId,
  onSelect,
  onlineIds,
  onLogout,
  onOpenAdmin,
}: Props) {
  const isAdmin = user.username === "admin";

  return (
    <aside className="flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col border-zinc-800 bg-app-sidebar max-md:border-b md:h-full md:max-h-none md:min-w-[18rem] md:max-w-[20rem] md:w-80 md:border-r">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              label={user.display_name}
              color={user.avatar_color}
              online={onlineIds.has(user.id)}
            />
            {isAdmin && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 ring-2 ring-app-sidebar">
                <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-white">{user.display_name}</p>
              {isAdmin && (
                <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  Admin
                </span>
              )}
            </div>
            <p className="truncate text-xs text-zinc-500">@{user.username}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Admin Panel"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-indigo-400 transition hover:bg-indigo-500/10 hover:text-indigo-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Messages
        </p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-1">
          {conversations.map((c) => {
            const isSel = c.id === selectedId;
            const peerOnline =
              c.type === "dm" && c.peer ? onlineIds.has(c.peer.id) : undefined;
            const title = c.title;
            const subtitle = c.last_message?.preview ?? "No messages yet";
            const time = c.last_message?.created_at ?? c.updated_at;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${
                    isSel
                      ? "bg-zinc-800/80 shadow-glow-sm ring-1 ring-indigo-500/30"
                      : "hover:bg-zinc-800/50"
                  }`}
                >
                  {c.type === "group" ? (
                    <Avatar label={c.title.slice(0, 2)} color="#4f46e5" />
                  ) : (
                    <Avatar
                      label={c.peer?.display_name ?? "?"}
                      color={c.peer?.avatar_color ?? "#666"}
                      online={peerOnline}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium text-white">{title}</span>
                        {c.type === "dm" && c.peer?.username === "admin" && (
                          <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {formatListTime(time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-zinc-500">{subtitle}</span>
                      {c.unread_count > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-bold text-white">
                          {c.unread_count > 9 ? "9+" : c.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
