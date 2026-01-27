'use client'

import Link from 'next/link'

const BILL_TYPE_LABELS: Record<string, string> = {
    BI: 'First Reading',
    BP: 'Second Reading',
}

interface Speaker {
    memberId: string
    name: string
    designation?: string | null
}

interface Bill {
    id: string
    billId?: string | null  // Parent bill ID for unified linking
    sectionType: string
    sectionTitle: string
    contentPlain?: string
    sessionDate: string
    sessionId: string
    ministry?: string | null
    speakers: Speaker[]
}

interface BillCardProps {
    bill: Bill
    showDate?: boolean
}

export default function BillCard({ bill, showDate = true }: BillCardProps) {
    const typeLabel = BILL_TYPE_LABELS[bill.sectionType] || bill.sectionType
    const speakers = Array.isArray(bill.speakers)
        ? bill.speakers.filter(s => s !== null && s !== undefined)
        : []
    const speakerNames = speakers.map((s) => s.name).join(', ')

    // Link to unified bill page if billId exists, otherwise fall back to section id
    const linkHref = bill.billId ? `/bills/${bill.billId}` : `/bills/${bill.id}`

    return (
        <Link href={linkHref}>
            <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-700">
                {/* Header */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        {typeLabel}
                    </span>
                    {bill.ministry && (
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {bill.ministry}
                        </span>
                    )}
                    {showDate && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(bill.sessionDate).toLocaleDateString('en-SG', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })}
                        </span>
                    )}
                </div>

                {/* Title */}
                <h3 className="mb-2 line-clamp-2 font-semibold text-zinc-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                    {bill.sectionTitle}
                </h3>

                {/* Speakers - only show for Second Reading */}
                {bill.sectionType === 'BP' && speakerNames && (
                    <p className="line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {speakerNames}
                    </p>
                )}
            </div>
        </Link>
    )
}
