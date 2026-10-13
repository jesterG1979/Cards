import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Card Price",
    short_name: "Card Price",
    description: "Pokémon card prices in Australian dollars.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f1e4",
    theme_color: "#ffcc00",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
