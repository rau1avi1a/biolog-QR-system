// app/api/files/status/route.js
import { NextResponse } from 'next/server'
import { listFiles }   from '@/services/file.service'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    // 🚫 turn off the "only new" filter:
    const all = await listFiles({ folderId: null, onlyNew: false })

    // 🚧 now *filter* in‐memory for the status you asked for:
    const files = all.filter(f => f.status === status)

    return NextResponse.json({ files })
  } catch (err) {
    console.error('GET /api/files/status', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
