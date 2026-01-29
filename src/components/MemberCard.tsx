import Link from 'next/link'
import type { Member } from '@/types'

interface MemberCardProps {
    member: Member
}

export default function MemberCard({ member }: MemberCardProps) {
    return (
        <Link
            href={`/members/${member.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
        >
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900">{member.name}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {member.sectionCount || 0} involvements
                </span>
            </div>
            {(member.designation || member.constituency) && (
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-500">
                    {member.designation && (
                        <span>{member.designation}</span>
                    )}
                    {member.constituency && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                            {member.constituency}
                        </span>
                    )}
                </div>
            )}
        </Link>
    )
}
