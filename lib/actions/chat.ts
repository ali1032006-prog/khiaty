"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { chatUnlocked } from "@/lib/orders/stateMachine";
import { securityEvent } from "@/lib/log";

const schema = z.object({ orderId: z.string().uuid(), body: z.string().trim().min(1).max(2000) });

/** Only a party to a PAID-or-later order may post. The RLS policy applies the same rule to reads. */
export async function sendMessage(formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Message required." };

  const order = await db.order.findUnique({ where: { id: parsed.data.orderId } });
  if (!order || (order.customerId !== user.id && order.providerId !== user.id)) {
    securityEvent("chat.send.denied", { userId: user.id, orderId: parsed.data.orderId, reason: "not a party" });
    return { error: "Not your order." };
  }
  if (!chatUnlocked(order.status)) {
    securityEvent("chat.send.denied", { userId: user.id, orderId: order.id, reason: "not paid" });
    return { error: "Chat unlocks after payment." };
  }

  await db.message.create({ data: { orderId: order.id, senderId: user.id, body: parsed.data.body } });
  return {};
}
