import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { AppDataProvider } from "@/components/AppDataProvider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Monitor Kondisi Pompa | PT TH Indoplantation",
  description:
    "Sistem pencatatan pemeriksaan dan pelaporan kondisi pompa PT TH Indoplantation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-field-bg text-field-ink font-sans">
        <a href="#main-content" className="skip-link no-print">
          Lewati ke konten utama
        </a>
        <AppDataProvider>{children}</AppDataProvider>
      </body>
    </html>
  );
}
