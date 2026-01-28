// src/app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const offset = (page - 1) * limit
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    try {
        const params: (string | number)[] = []
        let paramCount = 1
        let whereClause = '1=1'

        if (startDate) {
            whereClause += ` AND s.date >= $${paramCount}`
            params.push(startDate)
            paramCount++
        }

        if (endDate) {
            whereClause += ` AND s.date <= $${paramCount}`
            params.push(endDate)
            paramCount++
        }

        // Get total count
        const countSql = `SELECT COUNT(*) as total FROM sessions s WHERE ${whereClause}`
        const countResult = await query(countSql, params)
        const total = parseInt(countResult.rows[0].total)

        // Get data
        const sql = `
      SELECT 
        s.id,
        s.date,
        s.sitting_no as "sittingNo",
        s.parliament,
        s.session_no as "sessionNo",
        s.volume_no as "volumeNo",
        s.format,
        s.url,
        s.summary,
        COUNT(sec.id) as "questionCount"
      FROM sessions s
      LEFT JOIN sections sec ON s.id = sec.session_id
      WHERE ${whereClause}
      GROUP BY s.id
      ORDER BY s.date DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

        const dataParams = [...params, limit, offset]
        const result = await query(sql, dataParams)

        return NextResponse.json({
            sessions: result.rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
    } catch (error) {
        console.error('Database error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch sessions' },
            { status: 500 }
        )
    }
}
