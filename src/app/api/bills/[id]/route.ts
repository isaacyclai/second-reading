import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Get bill info
    const billResult = await query(
      `SELECT 
              b.id,
              b.title,
              b.first_reading_date as "firstReadingDate",
              b.first_reading_session_id as "firstReadingSessionId",
              m.id as "ministryId",
              m.acronym as ministry,
              m.name as "ministryName"
            FROM bills b
            LEFT JOIN ministries m ON b.ministry_id = m.id
            WHERE b.id = $1`,
      [id]
    )

    if (billResult.rows.length === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    const bill = billResult.rows[0]

    // Get all sections for this bill (both BI and BP, ordered by date and order)
    const sectionsResult = await query(
      `SELECT 
              s.id,
              s.session_id as "sessionId",
              s.section_type as "sectionType",
              s.section_title as "sectionTitle",
              s.content_html as "contentHtml",
              s.content_plain as "contentPlain",
              s.section_order as "sectionOrder",
              s.source_url as "sourceUrl",
              sess.date as "sessionDate",
              sess.sitting_no as "sittingNo",
              COALESCE(
                json_agg(
                  json_build_object(
                    'memberId', mem.id,
                    'name', mem.name,
                    'constituency', ss.constituency,
                    'designation', ss.designation
                  ) ORDER BY mem.name
                ) FILTER (WHERE mem.id IS NOT NULL),
                '[]'
              ) as speakers
            FROM sections s
            JOIN sessions sess ON s.session_id = sess.id
            LEFT JOIN section_speakers ss ON s.id = ss.section_id
            LEFT JOIN members mem ON ss.member_id = mem.id
            WHERE s.bill_id = $1
            GROUP BY s.id, s.session_id, s.section_type, s.section_title, s.content_html,
                     s.content_plain, s.section_order, s.source_url, sess.date, sess.sitting_no
            ORDER BY sess.date ASC, s.section_order ASC`,
      [id]
    )

    // Group sections by type
    const firstReadings = sectionsResult.rows.filter((s: { sectionType: string }) => s.sectionType === 'BI')
    const secondReadings = sectionsResult.rows.filter((s: { sectionType: string }) => s.sectionType === 'BP')

    // Get unique second reading dates
    const secondReadingDates = [...new Set(secondReadings.map((s: { sessionDate: string }) => s.sessionDate))]

    return NextResponse.json({
      ...bill,
      firstReadings,
      secondReadings,
      secondReadingDates,
      sections: sectionsResult.rows
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    )
  }
}
