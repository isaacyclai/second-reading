import Link from 'next/link'
import type { Section } from '@/types'

// Map abbreviations to full names
const QUESTION_TYPE_LABELS: Record<string, string> = {
    'OA': 'Oral Answer to Oral Question',
    'WA': 'Written Answer',
    'WANA': 'Written Answer to Oral Question not answered by end of Question Time',
    'OS': 'Motion',
    'BP': 'Bill',
}

interface QuestionCardProps {
    question: Section
    showSpeakers?: boolean
    showContent?: boolean
    showDate?: boolean
}

export default function QuestionCard({
    question,
    showSpeakers = true,
    showContent = false,
    showDate = true
}: QuestionCardProps) {
    const speakerNames = Array.isArray(question.speakers)
        ? question.speakers
            .filter((s): s is NonNullable<typeof s> => s != null)
            .map((s) => (typeof s === 'string' ? s : s.name))
            .filter((name): name is string => name != null)
        : []

    const typeLabel = QUESTION_TYPE_LABELS[question.sectionType] || question.sectionType

    const isMotion = question.category === 'motion' || (!question.category && question.sectionType === 'OS')
    const isBill = ['BP', 'BI'].includes(question.sectionType)

    let badgeColorClass = "bg-blue-100 text-blue-700"
    let hoverBorderClass = "hover:border-blue-300"

    if (isMotion) {
        badgeColorClass = "bg-pink-100 text-pink-700"
        hoverBorderClass = "hover:border-pink-300"
    }
    else if (isBill) {
        badgeColorClass = "bg-purple-100 text-purple-700"
        hoverBorderClass = "hover:border-purple-300"
    }

    if (question.category === 'adjournment_motion') hoverBorderClass = "hover:border-orange-300"
    else if (question.category === 'clarification') hoverBorderClass = "hover:border-yellow-300"

    const linkHref = `/questions/${question.id}`

    return (
        <Link
            href={linkHref}
            className={`block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all ${hoverBorderClass} hover:shadow-md`}
        >
            <div className="mb-2 flex flex-wrap items-center gap-2">
                {!['adjournment_motion', 'clarification'].includes(question.category || '') && (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeColorClass}`}>
                        {typeLabel}
                    </span>
                )}
                {question.ministry && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {question.ministry}
                    </span>
                )}
                {question.category === 'adjournment_motion' && (
                    <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Adjournment Motion
                    </span>
                )}
                {question.category === 'clarification' && (
                    <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        Clarification
                    </span>
                )}
                {showDate && question.sessionDate && (
                    <span className="text-xs text-zinc-500">
                        {new Date(question.sessionDate).toLocaleDateString('en-SG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                )}
            </div>
            <h3 className="mb-2 font-semibold text-zinc-900">
                {question.sectionTitle}
            </h3>
            {showContent && (
                <div className="mb-3 line-clamp-6 space-y-2 text-sm text-zinc-600">
                    {question.contentSnippet
                        ?.split(/\n\n+/)
                        .filter((p: string) => p.trim())
                        .slice(0, 3)
                        .map((paragraph: string, i: number) => (
                            <p key={i}>{paragraph.trim()}</p>
                        ))}
                </div>
            )}
            {showSpeakers && speakerNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {speakerNames.slice(0, 3).map((name, i) => (
                        <span
                            key={i}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                        >
                            {name}
                        </span>
                    ))}
                    {speakerNames.length > 3 && (
                        <span className="text-xs text-zinc-500">+{speakerNames.length - 3} more</span>
                    )}
                </div>
            )}
        </Link>
    )
}
