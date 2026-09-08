import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Geist,
  Geist_Mono,
  Fraunces,
  Pixelify_Sans,
  Lora,
  Instrument_Sans,
  Courier_Prime,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import "./globals.css";
import { isOwner } from "./lib/session";
import Providers from "./components/Providers";
import Sidebar from "./components/Sidebar";
import VisitTracker from "./components/VisitTracker";
import SecretDoor from "./components/SecretDoor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Cozy serif for headings / the "bookshelf" feel.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Pixel font for the Plant Shop theme's headings.
const pixelify = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
});

// The Cottage typefaces: Lora (serif), Instrument Sans (body), Courier Prime
// (typewriter labels).
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const courier = Courier_Prime({
  variable: "--font-courier",
  weight: ["400", "700"],
  subsets: ["latin"],
});

// The Space pair — Grotesk for everything set in sans, Mono for the small
// caps-y labels. Grotesk is variable, so no weight list; Mono isn't, and it
// ships exactly two weights with matching italics.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bahar's house",
  description:
    "A cozy pixel house — a study full of books, a writing room, and an ESP32 workshop.",
  // Standalone home-screen app on iPhone / iPad.
  appleWebApp: {
    capable: true,
    title: "Bahar's House",
    statusBarStyle: "default",
  },
  icons: {
    // Both listed explicitly: setting `icons` at all overrides the app/icon.png
    // file convention, so the browser-tab icon has to be named here too.
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Matches the default (cottage) theme's --bg so the browser chrome blends in.
  themeColor: "#f3ede1",
  // Keep the layout sane inside the standalone web-app shell.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Shrink the layout when the on-screen keyboard opens instead of overlaying
  // it (Android; iOS ignores this — the Reader lifts its sheet manually).
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Owner-only rooms (e.g. roadmaps) are hidden from the nav for everyone else.
  const owner = await isOwner();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${pixelify.variable} ${lora.variable} ${instrument.variable} ${courier.variable} ${spaceGrotesk.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'cottage';}catch(e){}})();`}
        </Script>
      </head>
      <body className="min-h-full">
        <Providers>
          <Sidebar isOwner={owner} />
          <main className="flex min-h-screen flex-col pt-14 md:ml-56 md:pt-0">
            {children}
          </main>
          <VisitTracker />
          <SecretDoor />
        </Providers>
      </body>
    </html>
  );
}
