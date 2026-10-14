import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchFromParams } from "@/components/search-from-params";
import { SearchScreen } from "@/components/search-screen";

export const instant = false;

export const metadata: Metadata = {
  title: "Search",
};

export default function Page() {
  return (
    <Suspense fallback={<SearchScreen initialQuery="" />}>
      <SearchFromParams />
    </Suspense>
  );
}
