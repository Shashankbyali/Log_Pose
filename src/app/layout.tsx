import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LOG POSE — The route to a safer tomorrow.",
  description:
    "LOG POSE adds a safety intelligence layer to walking navigation in Bengaluru, comparing routes using mapped lighting, nearby activity, pedestrian infrastructure, emergency access and a physically verified Safe Haven network.",
  applicationName: "LOG POSE",
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[var(--background)] antialiased`}
    >
      <body className="min-h-full text-zinc-100">{children}</body>
    </html>
  );
}
