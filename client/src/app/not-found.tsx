import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 px-5 text-center bg-[#18181b]">
      <p className="text-red-400 text-sm">404 · A little lost?</p>
      <h1 className="text-3xl font-semibold">
        Your next favorite is back this way.
      </h1>
      <Link href="/" className="rounded-full bg-red-500 px-6 py-3 text-sm">
        Back to the menu →
      </Link>
    </main>
  );
}
