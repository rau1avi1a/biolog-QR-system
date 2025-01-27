import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Image from "next/image";
import Card from "@/components/ui/card"
import { ToastProvider } from "@/components/ui/toast"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Inventory - biolog",
  description: "Manage biolog inventory",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
            <Image
              src="/glass.png"
              alt="glass image"
              width={1600}
              height={1600}
              className="fixed top-0 left-0 w-full h-full object-cover z-[-1] pointer-events-none"
            />
        
        <div>
          <NavBar />
          <ToastProvider>{children}</ToastProvider>
        </div>
      </body>
    </html>
  );
}
