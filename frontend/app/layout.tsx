import type { Metadata } from "next";
import { Cinzel, Syne, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LiquidGoldShader } from "@/components/LiquidGoldShader";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["700", "800", "900"],
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["700", "800"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BreezePost — Your brand, enshrined daily.",
  description:
    "A private posting atelier. Bring your product photos once; BreezePost returns Instagram art every day, styled in your brand's identity.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${cinzel.variable} ${syne.variable} ${jakarta.variable} ${grotesk.variable} bg-[#0b0b0d] font-body text-white antialiased selection:bg-[#d4af37] selection:text-black min-h-screen flex flex-col justify-between overflow-x-hidden`}
      >
        <LiquidGoldShader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

