// middleware/rateLimit.js
import { NextResponse } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 5, // Number of points
  duration: 60, // Per 60 seconds
});

export async function rateLimitMiddleware(request) {
  const ip = request.ip;

  try {
    await rateLimiter.consume(ip);
    return NextResponse.next();
  } catch (rejRes) {
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }
}
