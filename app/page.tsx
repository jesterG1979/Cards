import type { Metadata } from "next";
import { HomeScreen } from "@/components/home-screen";

export const metadata: Metadata = {
  title: "Card Price",
};

export default function Page() {
  return <HomeScreen />;
}
