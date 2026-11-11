"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { savePhoto } from "@/lib/storage";
import type { ActionState } from "./auth";

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  budget: z.coerce.number().positive().max(100000), // dollars from the form
});

export async function createRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Rule: only customers create requests. Enforced here, not in the UI.
  const user = await requireRole("CUSTOMER");

  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    budget: formData.get("budget"),
  });
  if (!parsed.success) return { error: "Title (3+), description (10+) and a positive budget are required." };

  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const saved = await savePhoto(photo);
    if (typeof saved !== "string") return saved;
    photoPath = saved;
  }

  const request = await db.request.create({
    data: {
      customerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      budgetCents: Math.round(parsed.data.budget * 100),
      photoPath,
    },
  });
  revalidatePath("/customer");
  redirect(`/requests/${request.id}`);
}
