import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const instant = false;

export const metadata: Metadata = {
  title: "Search",
};

export default async function Page(props: PageProps<"/search">) {
  const params = await props.searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  redirect(query ? `/?q=${encodeURIComponent(query)}` : "/");
}
