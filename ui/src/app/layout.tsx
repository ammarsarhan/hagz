"use client";

// import type { Metadata } from "next";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// export const metadata: Metadata = {
//   title: "Hagz - Egypt's Largest Football Reservation Platform",
//   description: "Book your football pitches easily and securely on Hagz, Egypt's biggest platform for football reservations.",
//   keywords: "football reservations, football pitches, Egypt, sports booking, pitch booking, Hagz",
//   viewport: "width=device-width, initial-scale=1",
//   openGraph: {
//     title: "Hagz - Egypt's Largest Football Reservation Platform",
//     description: "Book your football pitches easily and securely on Hagz, Egypt's biggest platform for football reservations.",
//     url: "https://hagz.com",
//     siteName: "Hagz",
//     type: "website",
//   },
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
