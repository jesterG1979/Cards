"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-10">
      <h1 className="text-3xl font-extrabold">This page did not load.</h1>
      <p className="text-lg">Try it again, or go back home.</p>
      <Button type="button" size="xl" onClick={reset}>
        Try again
      </Button>
      <Link href="/" className={cn(buttonVariants({ size: "xl", variant: "secondary" }), "w-full")}>
        Home
      </Link>
    </main>
  );
}
