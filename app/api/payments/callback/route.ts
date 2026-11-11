import { NextResponse } from "next/server";
import { confirmPayment } from "@/lib/payments/confirm";

/**
 * Payment confirmation callback ("webhook"). No user session: this is a machine-to-machine call,
 * and trust comes from the per-payment secret. All logic lives in confirmPayment.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = await confirmPayment(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
