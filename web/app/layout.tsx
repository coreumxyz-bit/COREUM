import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./hero.css";
import "./motion.css";
import PointerGlow from "@/components/PointerGlow";
import ChatWidget from "@/components/ChatWidget";
import MotionInit from "@/components/MotionInit";

// variable font: the hero and nav use in-between weights like 450
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.coreum.xyz"),
  title: "Coreum — Deploy a core. Get a verifiable answer.",
  description:
    "DePIN compute & AI verification network on Robinhood Chain L2. Independent AI cores answer with commit-reveal; the majority verdict is sealed in a public hash-chained ledger, anchored to Robinhood Chain every hour. $CORS.",
  icons: { icon: "/logo.png", apple: "/apple-icon.png" },
  openGraph: {
    title: "Coreum — Deploy a core. Get a verifiable answer.",
    description:
      "A DePIN network of AI cores on Robinhood Chain. Six cores check any token before you buy it, commit before they reveal, and every verdict is sealed on-chain. $CORS.",
  },
  // images come from app/opengraph-image.tsx + twitter-image.tsx (live card)
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PointerGlow />
        <MotionInit />
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      </body>
    </html>
  );
}
