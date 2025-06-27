// app/auth/login/page.jsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/shadcn/components/button';
import { Input } from '@/components/ui/shadcn/components/input';
import { Label } from '@/components/ui/shadcn/components/label';
import { Card } from '@/components/ui/shadcn/components/card';
import Image from 'next/image';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth?action=login', { // ✅ Fixed URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to sign in');

      // Successfully signed in - redirect to home
      window.location.href = '/home'; // Changed from '/' to '/home'
      console.log('Redirecting to home')
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Image
        src="/glass.png"
        alt="background"
        width={1600}
        height={1600}
        className="fixed top-0 left-0 w-full h-full object-cover z-[-1] pointer-events-none"
        priority
      />
      
      <Card className="p-8 w-full max-w-md space-y-6 bg-white/90 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to Biolog Inventory</h1>
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