import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''

  try {
    // Get member info with summary and most recent designation/constituency
    // Check both section_speakers and session_attendance
    const memberResult = await query(
      `SELECT 
              m.id, 
              m.name, 
              ms.summary,
              COALESCE(
                (
                  SELECT ss2.constituency 
                  FROM section_speakers ss2
                  JOIN sections s2 ON ss2.section_id = s2.id
                  JOIN sessions sess2 ON s2.session_id = sess2.id
                  WHERE ss2.member_id = m.id AND ss2.constituency IS NOT NULL
                  ORDER BY sess2.date DESC
                  LIMIT 1
                ),
                (
                  SELECT sa.constituency
                  FROM session_attendance sa
                  JOIN sessions sess ON sa.session_id = sess.id
                  WHERE sa.member_id = m.id AND sa.constituency IS NOT NULL
                  ORDER BY sess.date DESC
                  LIMIT 1
                )
              ) as constituency,
              COALESCE(
                (
                  SELECT ss3.designation 
                  FROM section_speakers ss3
                  JOIN sections s3 ON ss3.section_id = s3.id
                  JOIN sessions sess3 ON s3.session_id = sess3.id
                  WHERE ss3.member_id = m.id AND ss3.designation IS NOT NULL
                  ORDER BY sess3.date DESC
                  LIMIT 1
                ),
                (
                  SELECT sa2.designation
                  FROM session_attendance sa2
                  JOIN sessions sess4 ON sa2.session_id = sess4.id
                  WHERE sa2.member_id = m.id AND sa2.designation IS NOT NULL
                  ORDER BY sess4.date DESC
                  LIMIT 1
                )
              ) as designation
            FROM members m
            LEFT JOIN member_summaries ms ON m.id = ms.member_id
            WHERE m.id = $1`,
      [id]
    )

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberResult.rows[0]

    // Get questions this member spoke in (excluding bills)
    let questionsSql = `SELECT 
              s.id,
              s.section_type as "sectionType",
              s.section_title as "sectionTitle",
              s.content_plain as "contentPlain",
              s.category,
              m.acronym as ministry,
              sess.date as "sessionDate",
              ss.designation,
              ss.constituency
            FROM section_speakers ss
            JOIN sections s ON ss.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            LEFT JOIN ministries m ON s.ministry_id = m.id
            WHERE ss.member_id = $1 AND s.section_type NOT IN ('BI', 'BP')`

    const questionsParams: (string | number)[] = [id]
    let qParamCount = 2

    if (search) {
      questionsSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $${qParamCount}) OR 
            s.section_title ILIKE $${qParamCount + 1}
        )`
      questionsParams.push(search, `%${search}%`)
      qParamCount += 2
    }

    questionsSql += ` ORDER BY sess.date DESC, s.section_order ASC LIMIT 100`

    const questionsResult = await query(questionsSql, questionsParams)

    // Get bills this member is involved in (BP sections only, with bill_id for linking)
    let billsSql = `SELECT DISTINCT ON (s.bill_id)
              s.bill_id as "billId",
              s.section_type as "sectionType",
              s.section_title as "sectionTitle",
              m.acronym as ministry,
              sess.date as "sessionDate"
            FROM section_speakers ss
            JOIN sections s ON ss.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            LEFT JOIN ministries m ON s.ministry_id = m.id
            WHERE ss.member_id = $1 AND s.section_type = 'BP' AND s.bill_id IS NOT NULL`

    const billsParams: (string | number)[] = [id]
    let bParamCount = 2

    if (search) {
      billsSql += ` AND (
            to_tsvector('english', s.content_plain) @@ plainto_tsquery('english', $${bParamCount}) OR 
            s.section_title ILIKE $${bParamCount + 1}
        )`
      billsParams.push(search, `%${search}%`)
      bParamCount += 2
    }

    billsSql += ` ORDER BY s.bill_id, sess.date DESC LIMIT 50`

    const billsResult = await query(billsSql, billsParams)

    return NextResponse.json({
      ...member,
      questions: questionsResult.rows,
      bills: billsResult.rows
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch member' },
      { status: 500 }
    )
  }
}
