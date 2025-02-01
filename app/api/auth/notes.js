// // app/api/chemicals/route.js
// import { withAuth, withRole } from '@/lib/api-auth';

// export const POST = withRole(async (request) => {
//   // Your existing POST logic here
//   // The request is guaranteed to be authenticated and authorized
// }, ['admin', 'user']);

// export const GET = withAuth(async (request) => {
//   // Your existing GET logic here
//   // The request is guaranteed to be authenticated
// });




// // app/api/protected/route.js
// import { withAuth, withRole } from '@/lib/api-auth';
// import { NextResponse } from 'next/server';

// /**
//  * Handler for the protected route.
//  * @param {Request} request - The incoming request.
//  * @param {Object} user - The authenticated user object.
//  * @returns {Response} - The API response.
//  */
// async function handler(request, user) {
//   // Your protected logic here
//   return NextResponse.json({
//     message: 'This is a protected route.',
//     user: {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       role: user.role,
//     },
//   });
// }

// // Wrap the handler with authentication
// export const GET = withAuth(handler);
// export const POST = withAuth(handler);

// // For role-based access, e.g., only 'admin' can access
// export const DELETE = withRole(handler, ['admin']);
