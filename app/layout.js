// app/layout.js
import { Geist, Geist_Mono } from 'next/font/google';
import Image from 'next/image';
import './globals.css';

import Providers from './providers';         // React-Query + Session context
import { ToastProvider } from '@/components/ui/toast';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata = {
  title: 'biolog',
  description: 'Biolog MFG',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* QR Code Libraries */}
        <script src="https://unpkg.com/jsqr@1.4.0/dist/jsQR.js" async />
        <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js" async />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* full-screen background */}
        <Image
          src="/glass.png"
          alt="background"
          width={1600}
          height={1600}
          className="fixed inset-0 w-full h-full object-cover z-[-1] pointer-events-none"
          priority
        />

        {/* Wrapped in both React-Query, Session, and Toast contexts */}
        <Providers session={null}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}