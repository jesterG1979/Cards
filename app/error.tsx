"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-10">
      <h1 className="text-3xl font-extrabold">That page broke.</h1>
      <Button type="button" size="xl" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
