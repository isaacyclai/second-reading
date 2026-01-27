import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get members with their most recent designation and constituency
    let sql = `
    SELECT 
      m.id,
      m.name,
      ms.summary,
      COUNT(DISTINCT ss.section_id) as "sectionCount",
      (
        SELECT ss2.constituency 
        FROM section_speakers ss2
        JOIN sections s2 ON ss2.section_id = s2.id
        JOIN sessions sess2 ON s2.session_id = sess2.id
        WHERE ss2.member_id = m.id AND ss2.constituency IS NOT NULL
        ORDER BY sess2.date DESC
        LIMIT 1
      ) as constituency,
      (
        SELECT ss3.designation 
        FROM section_speakers ss3
        JOIN sections s3 ON ss3.section_id = s3.id
        JOIN sessions sess3 ON s3.session_id = sess3.id
        WHERE ss3.member_id = m.id AND ss3.designation IS NOT NULL
        ORDER BY sess3.date DESC
        LIMIT 1
      ) as designation
    FROM members m
    LEFT JOIN member_summaries ms ON m.id = ms.member_id
    LEFT JOIN section_speakers ss ON m.id = ss.member_id
    WHERE 1=1
  `

    const params: (string | number)[] = []
    let paramCount = 1

    if (search) {
        sql += ` AND m.name ILIKE $${paramCount}`
        params.push(`%${search}%`)
        paramCount++
    }

    sql += ` GROUP BY m.id, m.name, ms.summary
           ORDER BY m.name ASC
           LIMIT $${paramCount}`
    params.push(limit)

    try {
        const result = await query(sql, params)
        return NextResponse.json(result.rows)
    } catch (error) {
        console.error('Database error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
        )
    }
}
