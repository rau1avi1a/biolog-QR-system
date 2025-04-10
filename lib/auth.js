import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import connectMongoDB from "@lib/index";
import User from "@/models/User";
import { redirect } from "next/navigation";

/**
 * Reusable auth check for server components
 * @param {string} [loginPath="/"] - Where to redirect if unauthorized
 * @returns {Promise<Object|null>} The user or redirects
 */
export async function basicAuth(loginPath = "/") {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value ?? null;

  if (!token) {
    redirect(loginPath);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    await connectMongoDB();
    const user = await User.findById(payload.userId).select("-password");
    if (!user) {
      redirect(loginPath);
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error("Auth error:", error);
    redirect(loginPath);
  }
}
