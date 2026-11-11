import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { chatUnlocked } from "@/lib/orders/stateMachine";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of chat messages. The browser opens this once with EventSource
 * and receives each new message as an event; no manual refresh needed.
 * Access rule is checked once at connect time and again on every poll (status could change).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order || (order.customerId !== user.id && order.providerId !== user.id)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!chatUnlocked(order.status)) return new Response("Chat locked", { status: 403 });

  const since = new URL(req.url).searchParams.get("since");
  let cursor = since ? new Date(since) : new Date(0);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        try { controller.close(); } catch {}
      });

      const push = async () => {
        if (closed) return;
        const fresh = await db.message.findMany({
          where: { orderId: id, createdAt: { gt: cursor } },
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true } } },
        });
        for (const m of fresh) {
          cursor = m.createdAt;
          const payload = JSON.stringify({ id: m.id, body: m.body, createdAt: m.createdAt, sender: m.sender });
          controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
        }
        if (fresh.length === 0) controller.enqueue(encoder.encode(`: ping\n\n`)); // keep-alive
      };

      await push();
      const timer = setInterval(push, 1500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
