"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ActionState } from "./auth";
import { securityEvent } from "@/lib/log";

const schema = z.object({
  orderId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000),
});

export async function createReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("CUSTOMER");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Rating 1-5 and a comment are required." };

  const order = await db.order.findUnique({ where: { id: parsed.data.orderId }, include: { review: true } });
  if (!order || order.customerId !== user.id) {
    securityEvent("review.create.denied", { userId: user.id, orderId: parsed.data.orderId });
    return { error: "Order not found." };
  }
  if (order.status !== "COMPLETED") return { error: "You can review once the order is completed." };
  if (order.review) return { error: "You already reviewed this order." };

  await db.review.create({
    data: {
      orderId: order.id,
      customerId: user.id,
      providerId: order.providerId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
  });
  revalidatePath(`/orders/${order.id}`);
  return undefined;
}
