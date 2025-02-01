// components/NavBar.js
"use client";

import { useState } from 'react';
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { SignInDialog } from '@/components/auth/SignInDialog';
import { useRouter, usePathname } from 'next/navigation'; // Removed SignUpDialog
import { useEffect } from 'react'; // If needed

export default function NavBar({ user }) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // Get the current pathname

  // Define paths where NavBar should be hidden
  const hideNavBarPaths = ['/auth/login'];

  // If the current path is in hideNavBarPaths, do not render NavBar
  if (hideNavBarPaths.includes(pathname)) {
    return null;
  }

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to logout');

      // Redirect to login page after logout
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Optionally, display an error message to the user
    }
  };

  return (
    <nav className="relative z-50 flex justify-between items-center bg-slate-800 px-8 py-3">
      <div className="flex space-x-6">
        <Link
          href="/"
          className="text-white hover:text-gray-300 transition-colors">
          Home
        </Link>
        <Link
        href="/cyclecount"
        className="text-white hover:text-gray-300 transition-colors"
        >
          Cycle Count
        </Link>
        <Link
        href="/docs"
        className="text-white hover:text-gray-300 transition-colors"
        >
          Files
        </Link>

      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <span className="text-white hover:text-gray-300 transition-colors">Welcome, {user.name}</span>
            <Button
              variant="ghost hover:ghost"
              className="text-white hover:text-gray-300 transition-colors"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost hover:ghost"
              className="text-white hover:text-gray-300 transition-colors"
              onClick={() => setIsSignInOpen(true)}
            >
              Sign In
            </Button>
          </>
        )}
      </div>

      <SignInDialog
        open={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
      />
    </nav>
  );
}
