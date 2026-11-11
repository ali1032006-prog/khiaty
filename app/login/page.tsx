import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <LoginForm />
      <p className="mt-6 rounded bg-amber-50 p-3 text-xs text-amber-900">
        Demo accounts (password <code>password123</code>): customer1@demo.test, customer2@demo.test,
        tailor1@demo.test, tailor2@demo.test, tailor3@demo.test
      </p>
    </div>
  );
}
