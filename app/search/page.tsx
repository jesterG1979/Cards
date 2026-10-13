import type { Metadata } from "next";
import { SearchScreen } from "@/components/search-screen";

export const metadata: Metadata = {
  title: "Search",
};

export default async function Page(props: PageProps<"/search">) {
  const params = await props.searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  return <SearchScreen initialQuery={initialQuery} />;
}
