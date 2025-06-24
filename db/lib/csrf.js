// lib/csrf.js
import { initCsrf } from 'next-csrf';

const { csrf, setup } = initCsrf({
  secret: process.env.CSRF_SECRET,
});

export { csrf, setup };
