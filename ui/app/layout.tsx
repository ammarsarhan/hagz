import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hagz | Sports Pitch Booking Platform in Egypt",
    template: "%s | Hagz",
  },
  description:
    "Hagz is a sports pitch booking platform in Egypt that connects players with pitches. Book football grounds and sports facilities in seconds, manage bookings, payments, and schedules — all in one system.",
  applicationName: "Hagz",
  keywords: [
    "Hagz",
    "sports pitch booking",
    "football pitch booking Egypt",
    "book football ground",
    "sports facility management",
    "booking platform",
    "pitch owners dashboard",
    "online booking Egypt",
    "recurring bookings",
    "sports reservations",
  ],
  authors: [
    { name: "Ammar Sarhan" },
  ],
  creator: "Ammar Sarhan",
  publisher: "Hagz",
  metadataBase: new URL("https://hagz.com"),
  openGraph: {
    title: "Hagz | Book Sports Pitches in Egypt",
    description:
      "Book sports pitches in under 3 clicks. Hagz helps players find and book pitches while giving owners powerful tools to manage schedules, payments, and teams.",
    url: "https://hagz.com",
    siteName: "Hagz",
    locale: "en_EG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hagz | Sports Pitch Booking Platform",
    description:
      "A modern booking platform for sports pitches in Egypt. Built for players and pitch owners.",
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "Sports & Recreation",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
