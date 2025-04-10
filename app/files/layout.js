// app/files/layout.js

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import connectMongoDB from "@lib/index";
import User from "@/models/User";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import { ToastProvider } from "@/components/ui/toast";

export const metadata = {
  title: "Home - biolog",
  description: "Protected Home route",
};

/**
 * Fetch authenticated user from JWT
 */
async function getUser(token) {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    await connectMongoDB();
    const user = await User.findById(payload.userId).select("-password");
    if (!user) return null;

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

/**
 * Protected layout for /home
 */
export default async function HomeLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value ?? null;
  const user = await getUser(token);

  // If not logged in, redirect
  if (!user) {
    redirect("/");
  }

  return (
    // No <html> or <body> here – only the top-level layout should have those
    <>
      <Image
        src="/glass.png"
        alt="background"
        width={1600}
        height={1600}
        className="fixed top-0 left-0 w-full h-full object-cover z-[-1] pointer-events-none"
        priority
      />
      <NavBar user={user} />
      <ToastProvider>{children}</ToastProvider>
    </>
  );
}
