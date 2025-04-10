// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "biolog",
  description: "Minimal global layout",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Global background image */}
        <Image
          src="/glass.png"
          alt="background"
          width={1600}
          height={1600}
          className="fixed top-0 left-0 w-full h-full object-cover z-[-1] pointer-events-none"
          priority
        />

        {/* Wrap all pages in a toast provider; no NavBar here */}
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
