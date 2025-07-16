// app/page.jsx
import { redirect } from 'next/navigation'
import { basicAuth } from '@/db/lib/auth'

export default async function Page() {
  // if there's no valid token, basicAuth will redirect to /auth/login
  await basicAuth('/auth/login')

  // otherwise, we're authenticated—send them on to /home
  redirect('/home')
}
