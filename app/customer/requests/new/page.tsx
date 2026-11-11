import { requireRole } from "@/lib/auth";
import { NewRequestForm } from "./NewRequestForm";

export default async function NewRequestPage() {
  await requireRole("CUSTOMER");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">Post a request</h1>
      <p className="mt-1 text-sm text-stone-600">Describe what you need made or altered. Tailors will bid on it.</p>
      <NewRequestForm />
    </div>
  );
}
