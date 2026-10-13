import type { Metadata } from "next";
import { CollectionScreen } from "@/components/collection-screen";

export const metadata: Metadata = {
  title: "My cards",
};

export default function Page() {
  return <CollectionScreen />;
}
