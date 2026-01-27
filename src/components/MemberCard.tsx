import Link from 'next/link'
import type { Member } from '@/types'

interface MemberCardProps {
    member: Member
}

export default function MemberCard({ member }: MemberCardProps) {
    return (
        <Link
            href={`/members/${member.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
        >
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{member.name}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {member.sectionCount || 0} questions
                </span>
            </div>
            {(member.designation || member.constituency) && (
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {member.designation && (
                        <span>{member.designation}</span>
                    )}
                    {member.constituency && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                            {member.constituency}
                        </span>
                    )}
                </div>
            )}
            {member.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {member.summary}
                </p>
            )}
        </Link>
    )
}
