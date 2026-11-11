import type { OrderStatus, Prisma, Role } from "@prisma/client";

/**
 * The only place that knows which order transitions exist and who may trigger them.
 * "SYSTEM" means the payment callback, which acts without a logged-in user.
 */
export const TRANSITIONS: Record<OrderStatus, { to: OrderStatus; by: Role | "SYSTEM" } | null> = {
  ACCEPTED: { to: "PAID", by: "SYSTEM" },
  PAID: { to: "IN_PROGRESS", by: "PROVIDER" },
  IN_PROGRESS: { to: "DELIVERED", by: "PROVIDER" },
  DELIVERED: { to: "COMPLETED", by: "CUSTOMER" },
  COMPLETED: null,
};

export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  IN_PROGRESS: "Start work",
  DELIVERED: "Mark delivered",
  COMPLETED: "Confirm received",
};

export class TransitionError extends Error {
  constructor(message: string, public status: 403 | 409 = 409) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Moves an order to `to` after checking the current status allows it and the actor is allowed to.
 * Always runs inside a transaction so the status change and its audit event are written together.
 * Nothing else in the app writes Order.status.
 */
export async function transition(
  tx: Tx,
  orderId: string,
  to: OrderStatus,
  actor: { id: string; role: Role } | "SYSTEM",
) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new TransitionError("Order not found", 403);

  const rule = TRANSITIONS[order.status];
  if (!rule || rule.to !== to) {
    throw new TransitionError(`Cannot move an order from ${order.status} to ${to}.`);
  }

  if (actor === "SYSTEM") {
    if (rule.by !== "SYSTEM") throw new TransitionError("Only a user can do that.", 403);
  } else {
    if (rule.by !== actor.role) throw new TransitionError("Your role cannot do that.", 403);
    const isParty = actor.role === "CUSTOMER" ? order.customerId === actor.id : order.providerId === actor.id;
    if (!isParty) throw new TransitionError("You are not part of this order.", 403);
  }

  await tx.order.update({ where: { id: orderId }, data: { status: to } });
  await tx.orderEvent.create({
    data: {
      orderId,
      fromStatus: order.status,
      toStatus: to,
      actorId: actor === "SYSTEM" ? null : actor.id,
    },
  });
}

/** Chat is allowed only once money has moved. */
export function chatUnlocked(status: OrderStatus) {
  return status !== "ACCEPTED";
}
