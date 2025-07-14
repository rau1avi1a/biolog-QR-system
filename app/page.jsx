// app/page.jsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/shadcn/components/button';
import { Input } from '@/components/ui/shadcn/components/input';
import { Label } from '@/components/ui/shadcn/components/label';
import { Card } from '@/components/ui/shadcn/components/card';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth?action=me', {
          credentials: 'include'
        });
        if (res.ok) {
          // User is already logged in, redirect to home
          router.push('/home');
        }
      } catch (err) {
        // User is not logged in, stay on login page
      }
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Updated to match your API structure: POST /api/auth?action=login
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to sign in');

      // Successfully signed in - use window.location for full page reload
      window.location.href = '/home';
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="p-8 w-full max-w-md space-y-6 bg-white/90 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Biolog MFG</h1>
          <p className="text-gray-600">Please sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Uncomment if you want a registration link */}
        {/* <div className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={() => router.push('/auth/signup')}
            className="text-blue-600 hover:underline"
          >
            Create Account
          </button>
        </div> */}
      </Card>
    </div>
  );
}