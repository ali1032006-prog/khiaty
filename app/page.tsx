import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl font-bold">Khiaty</h1>
      <p className="mt-3 text-stone-600">
        Customers post tailoring requests. Tailors bid blind. Pay, chat, deliver, review.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/login" className="rounded bg-stone-900 px-4 py-2 text-white">Log in</Link>
        <Link href="/register" className="rounded border border-stone-300 px-4 py-2">Register</Link>
      </div>
    </div>
  );
}
