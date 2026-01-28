import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
    try {
        const sql = `
      SELECT DISTINCT constituency 
      FROM (
        SELECT constituency FROM section_speakers WHERE constituency IS NOT NULL
        UNION
        SELECT constituency FROM session_attendance WHERE constituency IS NOT NULL
      ) as c
      ORDER BY constituency ASC
    `
        const result = await query(sql)
        const constituencies = result.rows.map(row => row.constituency)
        return NextResponse.json(constituencies, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
        })
    } catch (error) {
        console.error('Database error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch constituencies' },
            { status: 500 }
        )
    }
}
