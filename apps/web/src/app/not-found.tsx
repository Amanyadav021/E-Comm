import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-6xl">🧭</p>
      <h1 className="mt-4 text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Back to home
      </Link>
    </div>
  );
}
