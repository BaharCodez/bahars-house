import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bahar's House",
    short_name: "Bahar's House",
    description:
      "A cozy pixel house — a study full of books, a writing room, and an ESP32 workshop.",
    start_url: "/",
    display: "standalone",
    // Kept in step with the default (cottage) theme's --bg / --accent.
    background_color: "#f3ede1",
    theme_color: "#3f5a3c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
