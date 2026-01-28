import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const limit = parseInt(searchParams.get('limit') || '50')

  // Get unified bills with their reading information
  let sql = `
    SELECT 
      b.id,
      b.title,
      b.first_reading_date as "firstReadingDate",
      b.first_reading_session_id as "firstReadingSessionId",
      m.id as "ministryId",
      m.acronym as ministry,
      m.name as "ministryName",
      -- Get second reading info from sections
      (SELECT MIN(sess.date) FROM sections s 
       JOIN sessions sess ON s.session_id = sess.id 
       WHERE s.bill_id = b.id AND s.section_type = 'BP') as "secondReadingDate",
      (SELECT s.session_id FROM sections s 
       JOIN sessions sess ON s.session_id = sess.id 
       WHERE s.bill_id = b.id AND s.section_type = 'BP' 
       ORDER BY sess.date LIMIT 1) as "secondReadingSessionId"
    FROM bills b
    LEFT JOIN ministries m ON b.ministry_id = m.id
    WHERE 1=1
  `

  const params: (string | number)[] = []
  let paramCount = 1

  if (search) {
    sql += ` AND (
      b.title ILIKE $${paramCount} OR
      EXISTS (
        SELECT 1 FROM sections s_search 
        WHERE s_search.bill_id = b.id 
        AND to_tsvector('english', s_search.content_plain) @@ plainto_tsquery('english', $${paramCount + 1})
      )
    )`
    params.push(`%${search}%`, search)
    paramCount += 2
  }

  sql += ` ORDER BY COALESCE(b.first_reading_date, 
             (SELECT MIN(sess.date) FROM sections s 
              JOIN sessions sess ON s.session_id = sess.id 
              WHERE s.bill_id = b.id)) DESC NULLS LAST
             LIMIT $${paramCount}`
  params.push(limit)

  try {
    const result = await query(sql, params)
    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    )
  }
}
