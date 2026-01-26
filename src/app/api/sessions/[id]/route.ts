// src/app/api/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        // Get session info
        const sessionResult = await query(
            `SELECT 
        id,
        date,
        sitting_no as "sittingNo",
        parliament,
        session_no as "sessionNo",
        volume_no as "volumeNo",
        format,
        url,
        summary
       FROM sessions 
       WHERE id = $1`,
            [id]
        )

        if (sessionResult.rows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const session = sessionResult.rows[0]

        // Get all questions in this session
        const questionsResult = await query(
            `SELECT 
        s.id,
        s.section_type as "sectionType",
        s.section_title as "sectionTitle",
        s.content_plain as "contentPlain",
        s.section_order as "sectionOrder",
        m.acronym as ministry,
        COALESCE(
          json_agg(
            json_build_object(
              'memberId', mem.id,
              'name', mem.name,
              'designation', ss.designation
            ) ORDER BY mem.name
          ) FILTER (WHERE mem.id IS NOT NULL),
          '[]'
        ) as speakers
       FROM sections s
       LEFT JOIN ministries m ON s.ministry_id = m.id
       LEFT JOIN section_speakers ss ON s.id = ss.section_id
       LEFT JOIN members mem ON ss.member_id = mem.id
       WHERE s.session_id = $1
       GROUP BY s.id, s.section_type, s.section_title, s.content_plain, s.section_order, m.acronym
       ORDER BY s.section_order ASC`,
            [id]
        )

        return NextResponse.json({
            ...session,
            questions: questionsResult.rows
        })
    } catch (error) {
        console.error('Database error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch session' },
            { status: 500 }
        )
    }
}
