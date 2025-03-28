import type { Metadata } from "next";
import AuthContextProvider from "@/context/auth";
import 'react-loading-skeleton/dist/skeleton.css'
import "./globals.css";

export const metadata: Metadata = {
  title: "Hagz"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthContextProvider>
          {children}
        </AuthContextProvider>
      </body>
    </html>
  );
}
