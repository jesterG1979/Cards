import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Card Price",
    template: "%s · Card Price",
  },
  description: "Point your camera at a Pokémon card and see the price in Australian dollars.",
  applicationName: "Card Price",
  appleWebApp: {
    capable: true,
    title: "Card Price",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffcc00",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-dvh bg-[#cfc6b6] text-foreground">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background shadow-2xl">
          {children}
          <ServiceWorker />
        </div>
      </body>
    </html>
  );
}
