"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { transition, TransitionError } from "@/lib/orders/stateMachine";
import { securityEvent } from "@/lib/log";

const USER_TARGETS: OrderStatus[] = ["IN_PROGRESS", "DELIVERED", "COMPLETED"];

/** Moves an order one step forward. All checks live in the state machine. */
export async function advanceOrder(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const to = String(formData.get("to") ?? "") as OrderStatus;
  if (!USER_TARGETS.includes(to)) return; // PAID is reserved for the payment callback

  try {
    await db.$transaction((tx) => transition(tx, orderId, to, { id: user.id, role: user.role }));
  } catch (e) {
    if (e instanceof TransitionError) {
      securityEvent("order.transition.denied", { userId: user.id, orderId, to, reason: e.message });
      return; // page re-renders with the real state
    }
    throw e;
  }
  revalidatePath(`/orders/${orderId}`);
}
