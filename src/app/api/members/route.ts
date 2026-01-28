import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const constituency = searchParams.get('constituency')
  const sort = searchParams.get('sort')
  const limit = parseInt(searchParams.get('limit') || '20')
  const page = parseInt(searchParams.get('page') || '1')
  const offset = (page - 1) * limit

  try {
    const params: (string | number)[] = []
    let paramCount = 1
    let whereClause = '1=1'

    if (search) {
      whereClause += ` AND mv.name ILIKE $${paramCount}`
      params.push(`%${search}%`)
      paramCount++
    }

    if (constituency) {
      whereClause += ` AND mv.constituency = $${paramCount}`
      params.push(constituency)
      paramCount++
    }

    // Determine sort order
    let orderBy = 'mv.name ASC'
    if (sort === 'involvements') {
      orderBy = 'mv.section_count DESC, mv.name ASC'
    } else if (sort === 'name_desc') {
      orderBy = 'mv.name DESC'
    }

    // Query the materialized view - this is now instant since data is pre-computed
    const sql = `
      SELECT 
        mv.id,
        mv.name,
        mv.summary,
        mv.section_count as "sectionCount",
        mv.constituency,
        mv.designation,
        COUNT(*) OVER() as "totalCount"
      FROM member_list_view mv
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

    const dataParams = [...params, limit, offset]
    const result = await query(sql, dataParams)

    // Extract total from first row (or 0 if no results)
    const total = result.rows.length > 0 ? parseInt(result.rows[0].totalCount) : 0

    // Remove totalCount from each row before sending response
    const members = result.rows.map(({ totalCount, ...rest }) => rest)

    return NextResponse.json({
      members,
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
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
