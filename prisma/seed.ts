/**
 * Demo data. Run with `npm run db:seed` (also runs automatically on `npm run dev` via db:setup).
 * Idempotent: wipes everything and starts fresh so you can reset the demo at any time.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const db = new PrismaClient();
const PASSWORD = "password123";

async function main() {
  // Order matters because of foreign keys.
  await db.message.deleteMany();
  await db.review.deleteMany();
  await db.orderEvent.deleteMany();
  await db.payment.deleteMany();
  await db.order.deleteMany();
  await db.bidRevision.deleteMany();
  await db.bid.deleteMany();
  await db.request.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const mk = (email: string, name: string, role: "CUSTOMER" | "PROVIDER") =>
    db.user.create({ data: { email, name, role, passwordHash: hash } });

  const [c1, c2, t1, t2, t3] = await Promise.all([
    mk("customer1@demo.test", "Amina (customer)", "CUSTOMER"),
    mk("customer2@demo.test", "Omar (customer)", "CUSTOMER"),
    mk("tailor1@demo.test", "Layla's Atelier", "PROVIDER"),
    mk("tailor2@demo.test", "Hassan Bespoke", "PROVIDER"),
    mk("tailor3@demo.test", "Nour Stitchworks", "PROVIDER"),
  ]);

  const offer = (rev: number, price: number, days: number, note: string) => ({
    revisionNumber: rev,
    priceCents: price * 100,
    timelineDays: days,
    note,
  });

  // 1. Open request, no bids yet (customer1).
  await db.request.create({
    data: {
      customerId: c1.id,
      title: "Hem and taper two pairs of wool trousers",
      description: "Two pairs, both need about 3 cm off the length and a slight taper below the knee. I can drop them off any weekday.",
      budgetCents: 6000,
    },
  });

  // 2. Open request with three bids, one declined and revised (customer1).
  await db.request.create({
    data: {
      customerId: c1.id,
      title: "Custom linen summer dress from reference photo",
      description: "Midi length, square neckline, side pockets. I have the fabric already (3 m of sand linen). Looking for a tailor who has done similar work.",
      budgetCents: 25000,
      bids: {
        create: [
          { providerId: t1.id, status: "PENDING", revisions: { create: [offer(1, 240, 14, "Happy to work with your fabric. Two fittings included.")] } },
          {
            providerId: t2.id,
            status: "PENDING",
            revisions: {
              create: [
                offer(1, 320, 10, "Fully lined, hand-finished hem."),
                offer(2, 275, 12, "Revised: unlined version as discussed, same finish quality."),
              ],
            },
          },
          { providerId: t3.id, status: "PENDING", revisions: { create: [offer(1, 199, 21, "Budget option, machine finished. Can start next month.")] } },
        ],
      },
    },
  });

  // Helper: build an awarded request + order in a given state.
  async function awarded(opts: {
    customerId: string;
    providerId: string;
    title: string;
    description: string;
    budget: number;
    price: number;
    status: "ACCEPTED" | "PAID" | "IN_PROGRESS" | "DELIVERED" | "COMPLETED";
    losers?: string[];
  }) {
    const request = await db.request.create({
      data: {
        customerId: opts.customerId,
        title: opts.title,
        description: opts.description,
        budgetCents: opts.budget * 100,
        status: "AWARDED",
      },
    });
    const bid = await db.bid.create({
      data: {
        requestId: request.id,
        providerId: opts.providerId,
        status: "ACCEPTED",
        revisions: { create: [offer(1, opts.price, 7, "Can do.")] },
      },
    });
    for (const loser of opts.losers ?? []) {
      await db.bid.create({
        data: { requestId: request.id, providerId: loser, status: "SUPERSEDED", revisions: { create: [offer(1, opts.price + 40, 9, "Alternative offer.")] } },
      });
    }
    const stages = ["ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;
    const reached = stages.slice(0, stages.indexOf(opts.status) + 1);
    const paid = opts.status !== "ACCEPTED";
    const order = await db.order.create({
      data: {
        requestId: request.id,
        bidId: bid.id,
        customerId: opts.customerId,
        providerId: opts.providerId,
        amountCents: opts.price * 100,
        status: opts.status,
        payment: {
          create: {
            amountCents: opts.price * 100,
            status: paid ? "SUCCEEDED" : "PENDING",
            providerRef: paid ? `mock_${randomBytes(8).toString("hex")}` : null,
            callbackSecret: randomBytes(32).toString("base64url"),
          },
        },
        events: {
          create: reached.map((s, i) => ({
            fromStatus: i === 0 ? null : reached[i - 1],
            toStatus: s,
            // PAID is done by the gateway (no actor); provider does start/deliver; customer accepts/completes.
            actorId: s === "PAID" ? null : s === "IN_PROGRESS" || s === "DELIVERED" ? opts.providerId : opts.customerId,
            createdAt: new Date(Date.now() - (reached.length - i) * 86_400_000),
          })),
        },
      },
    });
    return order;
  }

  // 3. Accepted but unpaid (customer2 + tailor1): lets you try the payment page.
  await awarded({
    customerId: c2.id, providerId: t1.id,
    title: "Take in a navy suit jacket", description: "Jacket is one size too big in the chest and waist. Sleeves are fine.",
    budget: 90, price: 85, status: "ACCEPTED", losers: [t3.id],
  });

  // 4. Paid with a few chat messages (customer1 + tailor2).
  const paidOrder = await awarded({
    customerId: c1.id, providerId: t2.id,
    title: "Replace zipper on leather jacket", description: "Main front zipper is broken. Would like a brass YKK replacement.",
    budget: 50, price: 45, status: "PAID",
  });
  await db.message.createMany({
    data: [
      { orderId: paidOrder.id, senderId: t2.id, body: "Thanks for the order! Can you drop the jacket off Thursday?", createdAt: new Date(Date.now() - 3_600_000 * 5) },
      { orderId: paidOrder.id, senderId: c1.id, body: "Thursday afternoon works. Around 4?", createdAt: new Date(Date.now() - 3_600_000 * 4) },
      { orderId: paidOrder.id, senderId: t2.id, body: "Perfect, see you then.", createdAt: new Date(Date.now() - 3_600_000 * 3) },
    ],
  });

  // 5. In progress (customer2 + tailor3).
  await awarded({
    customerId: c2.id, providerId: t3.id,
    title: "Shorten curtains (4 panels)", description: "Each panel needs 12 cm off the bottom with a blind hem.",
    budget: 70, price: 60, status: "IN_PROGRESS",
  });

  // 6. Delivered, waiting for customer confirmation (customer1 + tailor3).
  await awarded({
    customerId: c1.id, providerId: t3.id,
    title: "Patch and reinforce denim knees", description: "Two pairs of kids' jeans, visible mending style is fine.",
    budget: 40, price: 35, status: "DELIVERED",
  });

  // 7. Completed with a review (customer2 + tailor2).
  const done = await awarded({
    customerId: c2.id, providerId: t2.id,
    title: "Wedding shirt alterations", description: "Slim the body and shorten sleeves by 2 cm on a white dress shirt.",
    budget: 60, price: 55, status: "COMPLETED", losers: [t1.id],
  });
  await db.review.create({
    data: { orderId: done.id, customerId: c2.id, providerId: t2.id, rating: 5, comment: "Fit is perfect and it was ready a day early. Highly recommended." },
  });

  console.log("Seeded. All demo accounts use password:", PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
