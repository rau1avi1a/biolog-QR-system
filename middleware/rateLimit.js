// middleware/rateLimit.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const WINDOW_SIZE = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

const ipRequests = new Map();

export function rateLimit() {
  return async function handler(request) {
    const ip = request.ip || 'unknown';
    const now = Date.now();
    
    const requestTimestamps = ipRequests.get(ip) || [];
    const validTimestamps = requestTimestamps.filter(timestamp => 
      now - timestamp < WINDOW_SIZE
    );

    if (validTimestamps.length >= MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    validTimestamps.push(now);
    ipRequests.set(ip, validTimestamps);

    // Clean up old entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      for (const [key, timestamps] of ipRequests.entries()) {
        const validTs = timestamps.filter(ts => now - ts < WINDOW_SIZE);
        if (validTs.length === 0) {
          ipRequests.delete(key);
        } else {
          ipRequests.set(key, validTs);
        }
      }
    }

    return NextResponse.next();
  };
}

// Middleware wrapper for API routes
export function withRateLimit(handler) {
  return async function(request, context) {
    const limiter = rateLimit();
    const result = await limiter(request);
    
    if (result.status === 429) {
      return result;
    }
    
    return handler(request, context);
  };
}