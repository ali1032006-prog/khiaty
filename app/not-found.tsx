import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-stone-600">That page does not exist or you do not have access to it.</p>
      <Link href="/" className="mt-4 inline-block underline">Go home</Link>
    </div>
  );
}
