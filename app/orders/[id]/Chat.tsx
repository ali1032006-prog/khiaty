"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/lib/actions/chat";
import { createClient } from "@supabase/supabase-js";

export type ChatMessage = { id: string; body: string; createdAt: string; senderId: string };

type Props = {
  orderId: string;
  meId: string;
  initial: ChatMessage[];
  names: Record<string, string>; // userId -> display name for the two parties
  realtimeToken: string; // the user's short-lived access token, provided by the server page
};

/** Renders a local time only after mount: the server and the browser may format times differently. */
function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => setText(new Date(iso).toLocaleTimeString()), [iso]);
  return <div className="mt-0.5 min-h-[1em] text-[10px] opacity-60">{text}</div>;
}

/**
 * Live chat. History is rendered from the server; new rows arrive through Supabase Realtime.
 * Realtime only delivers rows the subscriber may SELECT under RLS, so a stranger who guesses
 * an order id subscribes to silence.
 */
export function Chat({ orderId, meId, initial, names, realtimeToken }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // No cookie access needed in the browser: the auth cookies are HttpOnly. The server page hands
    // us the user's current access token (valid about an hour) purely for the Realtime socket.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // RLS on the Realtime channel is evaluated with the token the socket presents, so attach
      // it before joining; otherwise the channel joins as "anon" and sees nothing.
      await supabase.realtime.setAuth(realtimeToken);
      if (cancelled) return;

      channel = supabase
        .channel(`order-${orderId}-messages`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "Message", filter: `orderId=eq.${orderId}` },
          (payload) => {
            const row = payload.new as ChatMessage;
            setMessages((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError("Live updates disconnected. Reload the page.");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId, realtimeToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="rounded border border-stone-200 bg-white">
      <div className="h-72 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-stone-500">No messages yet. Say hello.</p>}
        <ul className="space-y-2">
          {messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-stone-900 text-white" : "bg-stone-100"}`}>
                  {!mine && <div className="text-xs font-medium opacity-70">{names[m.senderId] ?? "Unknown"}</div>}
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <LocalTime iso={m.createdAt} />
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>
      <form
        ref={formRef}
        className="flex gap-2 border-t border-stone-200 p-3"
        action={(fd) =>
          start(async () => {
            const res = await sendMessage(fd);
            if (res.error) setError(res.error);
            else {
              setError(null);
              formRef.current?.reset();
            }
          })
        }
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input name="body" required maxLength={2000} placeholder="Type a message" className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm" autoComplete="off" />
        <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50">Send</button>
      </form>
      {error && <p className="px-3 pb-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
