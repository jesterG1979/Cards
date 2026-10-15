import Link from "next/link";

export function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <Link
        href="/"
        aria-label="Home"
        className="inline-flex h-11 items-center rounded-xl px-3 text-base font-extrabold text-sea"
      >
        ‹ Home
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
    </header>
  );
}
