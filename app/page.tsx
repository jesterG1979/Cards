import type { Metadata } from "next";
import { HomeScreen } from "@/components/home-screen";

export const instant = false;

export const metadata: Metadata = {
  title: "Card Price",
};

export default async function Page(props: PageProps<"/">) {
  const params = await props.searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  return <HomeScreen initialQuery={initialQuery} />;
}
