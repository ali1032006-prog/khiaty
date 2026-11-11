"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/lib/actions/chat";

type Msg = { id: string; body: string; createdAt: string; sender: { id: string; name: string } };

export function Chat({ orderId, meId }: { orderId: string; meId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // One long-lived connection; the server pushes each new message as it appears.
  useEffect(() => {
    const es = new EventSource(`/api/orders/${orderId}/messages/stream`);
    es.addEventListener("message", (e) => {
      const m = JSON.parse((e as MessageEvent).data) as Msg;
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    });
    es.onerror = () => setError("Connection lost. Reload the page.");
    return () => es.close();
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="rounded border border-stone-200 bg-white">
      <div className="h-72 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-stone-500">No messages yet. Say hello.</p>}
        <ul className="space-y-2">
          {messages.map((m) => {
            const mine = m.sender.id === meId;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-stone-900 text-white" : "bg-stone-100"}`}>
                  {!mine && <div className="text-xs font-medium opacity-70">{m.sender.name}</div>}
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className="mt-0.5 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString()}</div>
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
