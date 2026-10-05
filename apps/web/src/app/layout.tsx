import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"], 
  display: "swap", 
  variable: "--font-sans" 
});

const sourceSerif = Source_Serif_4({ 
  subsets: ["latin"], 
  style: ["normal", "italic"], 
  display: "swap", 
  variable: "--font-serif" 
});

export const metadata: Metadata = {
  title: "DropXYZ",
  description: "Temporary rooms for sharing files and messages.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="antialiased selection:bg-[var(--accent)] selection:text-[var(--bg)]">{children}</body>
    </html>
  );
}
