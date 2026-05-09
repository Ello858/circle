import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Socket } from "socket.io-client";
import { apiClient } from "../api";
import type { Conversation } from "../types";

type Ack =
  | { ok: true; message: unknown }
  | { error: string }
  | undefined;

type Props = {
  conversation: Conversation;
  socket: Socket | null;
  onSent?: () => void;
};

export default function MessageInput({
  conversation,
  socket,
  onSent,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingOnRef = useRef(false);

  const clearTypingTimer = () => {
    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current);
      typingStopRef.current = null;
    }
  };

  const emitTyping = useCallback(
    (typing: boolean) => {
      if (!socket || conversation.type !== "group") return;
      if (typingOnRef.current === typing) return;
      typingOnRef.current = typing;
      socket.emit("typing", { conversationId: conversation.id, typing });
    },
    [socket, conversation.id, conversation.type]
  );

  const scheduleTypingStop = useCallback(() => {
    clearTypingTimer();
    typingStopRef.current = setTimeout(() => {
      emitTyping(false);
    }, 2000);
  }, [emitTyping]);

  useEffect(() => {
    typingOnRef.current = false;
    return () => {
      clearTypingTimer();
      emitTyping(false);
    };
  }, [emitTyping, conversation.id]);

  const send = useCallback(
    (body: string, imagePath: string) => {
      if (!socket) return;
      setBusy(true);
      socket.emit(
        "message:send",
        {
          conversationId: conversation.id,
          body,
          imagePath,
        },
        (ack: Ack) => {
          setBusy(false);
          if (ack && "error" in ack && ack.error) {
            alert(ack.error);
            return;
          }
          setText("");
          emitTyping(false);
          onSent?.();
        }
      );
    },
    [socket, conversation.id, emitTyping, onSent]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    send(t, "");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    try {
      const { url } = await apiClient.uploadImage(file);
      const caption = text.trim();
      send(caption, url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-zinc-800 bg-app-chat/95 px-3 py-3 backdrop-blur md:px-6"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-indigo-500/50 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
          title="Attach image"
          aria-label="Attach image"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="m18.375 12.739-5.693 5.693a4.5 4.5 0 01-6.364-6.364l7.5-7.5a3 3 0 114.243 4.243L9.878 16.5"
            />
          </svg>
        </button>
        <textarea
          rows={1}
          value={text}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            if (conversation.type === "group") {
              emitTyping(true);
              scheduleTypingStop();
            }
          }}
          onBlur={() => {
            if (conversation.type === "group") {
              clearTypingTimer();
              emitTyping(false);
            }
          }}
          onKeyDown={onKeyDown}
          placeholder="Message…"
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-zinc-700 bg-app-sidebar px-4 py-3 text-sm text-white outline-none ring-indigo-500/30 placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="mb-2 shrink-0 rounded-2xl bg-app-bubbleOut px-5 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}
