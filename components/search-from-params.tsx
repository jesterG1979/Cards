"use client";

import { useSearchParams } from "next/navigation";
import { SearchScreen } from "@/components/search-screen";

/** Reads ?q= on the client so /search can be a static shell (and works from the offline cache). */
export function SearchFromParams() {
  const query = useSearchParams().get("q") ?? "";
  return <SearchScreen key={query} initialQuery={query} />;
}
