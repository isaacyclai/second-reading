// src/app/api/ministries/[id]/route.ts
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
        // Get ministry info
        const ministryResult = await query(
            `SELECT id, name, acronym FROM ministries WHERE id = $1`,
            [id]
        )

        if (ministryResult.rows.length === 0) {
            return NextResponse.json({ error: 'Ministry not found' }, { status: 404 })
        }

        const ministry = ministryResult.rows[0]

        // Get questions under this ministry (excluding bills)
        let questionsSql = `SELECT 
        s.id,
        s.section_type as "sectionType",
        s.section_title as "sectionTitle",
        s.content_plain as "contentPlain",
        sess.date as "sessionDate",
        ARRAY_AGG(DISTINCT mem.name ORDER BY mem.name) as speakers
       FROM sections s
       JOIN sessions sess ON s.session_id = sess.id
       LEFT JOIN section_speakers ss ON s.id = ss.section_id
       LEFT JOIN members mem ON ss.member_id = mem.id
       WHERE s.ministry_id = $1 AND s.section_type NOT IN ('BI', 'BP')`

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

        questionsSql += ` GROUP BY s.id, s.section_type, s.section_title, s.content_plain, sess.date, s.section_order
       ORDER BY sess.date DESC, s.section_order ASC
       LIMIT 100`

        const questionsResult = await query(questionsSql, questionsParams)

        // Get bills under this ministry (BP sections with bill_id for linking)
        let billsSql = `SELECT DISTINCT ON (s.bill_id)
        s.bill_id as "billId",
        s.section_type as "sectionType",
        s.section_title as "sectionTitle",
        sess.date as "sessionDate"
       FROM sections s
       JOIN sessions sess ON s.session_id = sess.id
       WHERE s.ministry_id = $1 AND s.section_type = 'BP' AND s.bill_id IS NOT NULL`

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
            ...ministry,
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
            { error: 'Failed to fetch ministry' },
            { status: 500 }
        )
    }
}
