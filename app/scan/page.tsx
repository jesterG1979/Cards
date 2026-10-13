import type { Metadata } from "next";
import { Scanner } from "@/components/scanner";

export const metadata: Metadata = {
  title: "Scan a card",
};

export default function Page() {
  return <Scanner />;
}
