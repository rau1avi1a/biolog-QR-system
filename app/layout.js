// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Image from "next/image";
import { ToastProvider } from "@/components/ui/toast";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose'; // Use 'jose' for verification
import connectMongoDB from '@lib/index.js';
import User from '@/models/User';

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

/**
 * Fetches and returns the authenticated user based on the JWT token.
 * @param {string|null} token - The JWT token from cookies.
 * @returns {Object|null} - The user object or null if not authenticated.
 */
async function getUser(token) {
  if (!token) return null;

  try {
    // Verify JWT using 'jose'
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    await connectMongoDB();
    const user = await User.findById(payload.userId).select('-password');

    if (!user) return null;

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Root Layout Component
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - The child components.
 * @returns {JSX.Element} - The HTML layout.
 */
export default async function RootLayout({ children }) {
  // Await the cookies() function as per Next.js requirements
  const cookiesList = await cookies();
  const token = cookiesList.get('auth_token')?.value ?? null;
  const user = await getUser(token);

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
          priority
        />

        <div>
          <NavBar user={user} />
          <ToastProvider>{children}</ToastProvider>
        </div>
      </body>
    </html>
  );
}
