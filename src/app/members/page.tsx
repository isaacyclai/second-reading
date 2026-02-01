import Link from 'next/link'
import MemberCard from '@/components/MemberCard'
import MemberFilters from '@/components/MemberFilters'
import { query } from '@/lib/db'
import ServerPagination from '@/components/ServerPagination'
import type { Member } from '@/types'

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const search = typeof params.search === 'string' ? params.search : ''
    const constituency = typeof params.constituency === 'string' ? params.constituency : ''
    const sort = typeof params.sort === 'string' ? params.sort : 'name'
    const pageNum = typeof params.page === 'string' ? parseInt(params.page) : 1
    const limit = 20
    const offset = (pageNum - 1) * limit

    // Fetch available constituencies for filters
    const constResult = await query('SELECT DISTINCT constituency FROM member_list_view WHERE constituency IS NOT NULL ORDER BY constituency')
    const constituencies = constResult.rows.map(r => r.constituency)

    // Build query for members
    const sqlParams: (string | number)[] = []
    let paramCount = 1
    let whereClause = '1=1'

    if (search) {
        whereClause += ` AND (
            mv.name ILIKE $${paramCount} OR 
            mv.constituency ILIKE $${paramCount} OR 
            mv.designation ILIKE $${paramCount}
        )`
        sqlParams.push(`%${search}%`)
        paramCount++
    }

    if (constituency) {
        whereClause += ` AND mv.constituency = $${paramCount}`
        sqlParams.push(constituency)
        paramCount++
    }

    // Determine sort order
    let orderBy = 'mv.name ASC'
    if (sort === 'involvements') {
        orderBy = 'mv.section_count DESC, mv.name ASC'
    } else if (sort === 'attendance') {
        orderBy = 'CASE WHEN sa.total > 0 THEN CAST(sa.present AS FLOAT) / sa.total ELSE 0 END DESC, mv.name ASC'
    }

    const sql = `
      SELECT 
        mv.id,
        mv.name,
        mv.summary,
        mv.section_count as "sectionCount",
        mv.constituency,
        mv.designation,
        sa.total as "attendanceTotal",
        sa.present as "attendancePresent",
        COUNT(*) OVER() as "totalCount"
      FROM member_list_view mv
      LEFT JOIN (
        SELECT member_id, COUNT(*) as total, SUM(CASE WHEN present THEN 1 ELSE 0 END) as present
        FROM session_attendance 
        GROUP BY member_id
      ) sa ON mv.id = sa.member_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `

    const dataResult = await query(sql, [...sqlParams, limit, offset])
    const totalCount = dataResult.rows.length > 0 ? parseInt(dataResult.rows[0].totalCount) : 0
    const totalPages = Math.ceil(totalCount / limit)
    const members: Member[] = dataResult.rows.map(({ totalCount, ...rest }) => ({
        ...rest,
        sectionCount: parseInt(rest.sectionCount),
        attendanceTotal: rest.attendanceTotal ? parseInt(rest.attendanceTotal) : 0,
        attendancePresent: rest.attendancePresent ? parseInt(rest.attendancePresent) : 0
    }))

    return (
        <div>
            <section className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    Members of Parliament
                </h1>
                <div className="mb-8 space-y-8 text-zinc-600">
                    <p className="leading-relaxed">
                        Here, you can find the individual profiles of Members of Parliament (MPs) along with their records of their involvements in Parliament.
                        In Singapore, there are three types of MPs.
                    </p>

                    <section>
                        <h3 className="mb-3 text-2xl font-bold text-zinc-900">Elected Members</h3>
                        <p className="mb-4 leading-relaxed">
                            Singapore is divided into different geographical areas known as constituencies. During elections, the residents of these
                            each constituency vote for one or more MPs who will represent them in Parliament. Some of these MPs will be appointed to positions
                            in the Government and become office holders. The rest of the elected MPs are known as backbenchers. Office holders include Ministers,
                            Senior Ministers of State, Ministers of State, and Senior Parliamentary Secretaries.
                        </p>
                    </section>

                    <section>
                        <h3 className="mb-3 text-2xl font-bold text-zinc-900">Non-Constituency Members</h3>
                        <p className="leading-relaxed">
                            NCMPs are declared as MPs from opposition parties who were not elected in the General Election, but received the highest percentage
                            of votes amongst the unelected candidates from the opposition parties.
                        </p>
                    </section>

                    <section>
                        <h3 className="mb-3 text-2xl font-bold text-zinc-900">Nominated Members</h3>
                        <p className="leading-relaxed">
                            NMPs are appointed by the President of Singapore and are meant to provide non-partisan views in Parliament.
                        </p>
                    </section>

                    <p className="mb-8 space-y-8 text-zinc-600">
                        Don&apos;t know who your MP is? Enter your postal code in the map below to find out!
                    </p>
                </div>
                <div className="mb-8 w-full overflow-hidden rounded-lg border border-zinc-200">
                    <iframe
                        title="2025 General Election Results Map"
                        src="https://elections.data.gov.sg/en/map?isScrollable=true&primaryColor=%236253E8&view=Winning%20margin&lang=en&year=2025&constituenciesView=all"
                        className="h-[1040px] w-full border-none md:h-[642px]"
                    />
                </div>
                <MemberFilters
                    constituencies={constituencies}
                    initialSearch={search}
                    initialConstituency={constituency}
                    initialSort={sort}
                />
            </section>

            {members.length === 0 ? (
                <p className="py-12 text-center text-zinc-500">
                    No members found
                </p>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {members.map((member) => (
                            <MemberCard key={member.id} member={member} />
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    <ServerPagination
                        currentPage={pageNum}
                        totalPages={totalPages}
                        baseUrl="/members"
                    />
                </>
            )}
        </div>
    )
}
