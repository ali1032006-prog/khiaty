"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { hashSecret, newCallbackSecret } from "@/lib/payments/secret";
import { securityEvent } from "@/lib/log";
import { Prisma } from "@prisma/client";
import type { ActionState } from "./auth";

const offerSchema = z.object({
  price: z.coerce.number().positive().max(100000),
  timelineDays: z.coerce.number().int().min(1).max(365),
  note: z.string().trim().min(1).max(2000),
});

function parseOffer(formData: FormData) {
  return offerSchema.safeParse({
    price: formData.get("price"),
    timelineDays: formData.get("timelineDays"),
    note: formData.get("note"),
  });
}

/** Provider places a first bid on an open request. Creates the Bid slot and revision #1. */
export async function placeBid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("PROVIDER");
  const requestId = String(formData.get("requestId") ?? "");
  const parsed = parseOffer(formData);
  if (!parsed.success) return { error: "Price, timeline (1-365 days) and a note are required." };

  const request = await db.request.findUnique({ where: { id: requestId }, select: { status: true } });
  if (!request || request.status !== "OPEN") return { error: "This request is no longer open." };

  try {
    await db.bid.create({
      data: {
        requestId,
        providerId: user.id,
        revisions: {
          create: {
            revisionNumber: 1,
            priceCents: Math.round(parsed.data.price * 100),
            timelineDays: parsed.data.timelineDays,
            note: parsed.data.note,
          },
        },
      },
    });
  } catch (e) {
    // Only the unique index on (requestId, providerId) means "duplicate"; anything else is a real error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "You already have a bid on this request. Revise it instead." };
    }
    throw e;
  }
  revalidatePath(`/requests/${requestId}`);
  return undefined;
}

/**
 * Provider revises a DECLINED bid. We never edit the previous revision: we append a new one
 * and flip the slot back to PENDING so the customer sees it as a fresh offer with full history.
 */
export async function reviseBid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("PROVIDER");
  const bidId = String(formData.get("bidId") ?? "");
  const parsed = parseOffer(formData);
  if (!parsed.success) return { error: "Price, timeline (1-365 days) and a note are required." };

  const bid = await db.bid.findUnique({
    where: { id: bidId },
    include: { request: { select: { status: true } }, revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  // Ownership check: the bid must be this provider's.
  if (!bid || bid.providerId !== user.id) {
    securityEvent("bid.revise.denied", { userId: user.id, bidId });
    return { error: "Bid not found." };
  }
  if (bid.status !== "DECLINED") return { error: "Only a declined bid can be revised." };
  if (bid.request.status !== "OPEN") return { error: "This request is no longer open." };

  await db.$transaction([
    db.bidRevision.create({
      data: {
        bidId,
        revisionNumber: bid.revisions[0].revisionNumber + 1,
        priceCents: Math.round(parsed.data.price * 100),
        timelineDays: parsed.data.timelineDays,
        note: parsed.data.note,
      },
    }),
    db.bid.update({ where: { id: bidId }, data: { status: "PENDING" } }),
  ]);
  revalidatePath(`/requests/${bid.requestId}`);
  return undefined;
}

/** Customer declines a pending bid on their own request. */
export async function declineBid(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const bidId = String(formData.get("bidId") ?? "");

  const bid = await db.bid.findUnique({ where: { id: bidId }, include: { request: true } });
  // Rule: only the request owner decides. Compare against the session user, never the form.
  if (!bid || bid.request.customerId !== user.id) {
    securityEvent("bid.decline.denied", { userId: user.id, bidId });
    return;
  }
  if (bid.status !== "PENDING" || bid.request.status !== "OPEN") return;

  await db.bid.update({ where: { id: bidId }, data: { status: "DECLINED" } });
  revalidatePath(`/requests/${bid.requestId}`);
}

/**
 * Customer accepts a pending bid. One transaction:
 * bid -> ACCEPTED, sibling bids -> SUPERSEDED, request -> AWARDED, create Order + pending Payment.
 */
export async function acceptBid(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const bidId = String(formData.get("bidId") ?? "");

  const bid = await db.bid.findUnique({
    where: { id: bidId },
    include: { request: true, revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
  });
  if (!bid || bid.request.customerId !== user.id) {
    securityEvent("bid.accept.denied", { userId: user.id, bidId });
    return;
  }
  if (bid.status !== "PENDING" || bid.request.status !== "OPEN") return;

  const latest = bid.revisions[0];
  const secret = newCallbackSecret(); // handed to the gateway; we keep only the hash
  const orderId = await db.$transaction(async (tx) => {
    await tx.bid.update({ where: { id: bidId }, data: { status: "ACCEPTED" } });
    await tx.bid.updateMany({
      where: { requestId: bid.requestId, id: { not: bidId }, status: { in: ["PENDING", "DECLINED"] } },
      data: { status: "SUPERSEDED" },
    });
    await tx.request.update({ where: { id: bid.requestId }, data: { status: "AWARDED" } });
    const order = await tx.order.create({
      data: {
        requestId: bid.requestId,
        bidId,
        customerId: user.id,
        providerId: bid.providerId,
        amountCents: latest.priceCents,
        status: "ACCEPTED",
        events: { create: { fromStatus: null, toStatus: "ACCEPTED", actorId: user.id } },
        payment: {
          create: {
            amountCents: latest.priceCents,
            callbackSecretHash: hashSecret(secret),
            gatewaySession: { create: { secret } },
          },
        },
      },
    });
    return order.id;
  });

  revalidatePath("/customer");
  redirect(`/orders/${orderId}`);
}
