import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";

export const metadata: Metadata = {
  title: "Khiaty",
  description: "Tailoring marketplace",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href={user ? homeFor(user.role) : "/"} className="text-lg font-semibold tracking-tight">
              Khiaty
            </Link>
            {user ? (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-stone-600">
                  {user.name} <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs uppercase">{user.role}</span>
                </span>
                <form action={logout}>
                  <button className="text-stone-600 hover:text-stone-900">Log out</button>
                </form>
              </div>
            ) : (
              <div className="flex gap-4 text-sm">
                <Link href="/login" className="hover:underline">Log in</Link>
                <Link href="/register" className="hover:underline">Register</Link>
              </div>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
