import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        // Get member info with summary and most recent designation/constituency
        const memberResult = await query(
            `SELECT 
              m.id, 
              m.name, 
              ms.summary,
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
            WHERE m.id = $1`,
            [id]
        )

        if (memberResult.rows.length === 0) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 })
        }

        const member = memberResult.rows[0]

        // Get sections this member spoke in
        const sectionsResult = await query(
            `SELECT 
              s.id,
              s.section_type as "sectionType",
              s.section_title as "sectionTitle",
              s.content_plain as "contentPlain",
              m.acronym as ministry,
              sess.date as "sessionDate",
              ss.designation,
              ss.constituency
            FROM section_speakers ss
            JOIN sections s ON ss.section_id = s.id
            JOIN sessions sess ON s.session_id = sess.id
            LEFT JOIN ministries m ON s.ministry_id = m.id
            WHERE ss.member_id = $1
            ORDER BY sess.date DESC, s.section_order ASC
            LIMIT 100`,
            [id]
        )

        return NextResponse.json({
            ...member,
            sections: sectionsResult.rows
        })
    } catch (error) {
        console.error('Database error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch member' },
            { status: 500 }
        )
    }
}
