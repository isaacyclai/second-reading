'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import AISummaryCard from '@/components/AISummaryCard'

interface Speaker {
    memberId: string
    name: string
    constituency: string | null
    designation: string | null
}

interface BillSection {
    id: string
    sessionId: string
    sectionType: string
    sectionTitle: string
    contentHtml: string
    contentPlain: string
    sessionDate: string
    sittingNo: number
    sourceUrl?: string | null
    speakers: Speaker[]
}

interface BillDetail {
    id: string
    title: string
    firstReadingDate: string | null
    firstReadingSessionId: string | null
    ministryId: string | null
    ministry: string | null
    ministryName: string | null
    summary: string | null
    firstReadings: BillSection[]
    secondReadings: BillSection[]
    secondReadingDates: string[]
    sections: BillSection[]
}

export default function BillDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const [bill, setBill] = useState<BillDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchBill() {
            try {
                const res = await fetch(`/api/bills/${id}`)
                if (!res.ok) throw new Error('Bill not found')
                const data = await res.json()
                setBill(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load bill')
            } finally {
                setLoading(false)
            }
        }
        fetchBill()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    if (error || !bill) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500">{error || 'Bill not found'}</p>
                <Link href="/bills" className="mt-4 text-purple-500 hover:underline">
                    ← Back to Bills
                </Link>
            </div>
        )
    }

    // Get unique speakers from all second reading sections
    const allSpeakers = bill.secondReadings.flatMap(s => s.speakers || [])
    const uniqueSpeakers = allSpeakers.filter((speaker, index, self) =>
        speaker && index === self.findIndex(s => s && s.memberId === speaker.memberId)
    )

    // Group unique second reading timelines
    const secondReadingTimelines = bill.secondReadings.reduce((acc, curr) => {
        if (!acc.find(item => item.sessionDate === curr.sessionDate)) {
            acc.push({ sessionDate: curr.sessionDate, sessionId: curr.sessionId });
        }
        return acc;
    }, [] as { sessionDate: string, sessionId: string }[]);

    return (
        <div className="mx-auto max-w-4xl">
            <Link href={`/sessions/${bill.firstReadingSessionId || bill.sections[0]?.sessionId}`} className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline">
                ← Back to Session
            </Link>

            <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                {/* Header */}
                <header className="mb-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        {bill.ministry && (
                            <Link
                                href={`/ministries/${bill.ministryId}`}
                                className="rounded bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
                            >
                                {bill.ministryName}
                            </Link>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900">
                        {bill.title}
                    </h1>
                </header>

                {/* Bill Summary */}
                <div className="mb-6">
                    <AISummaryCard
                        title="Bill Summary"
                        content={bill.summary}
                        fallbackMessage="Summary will be generated in a future update."
                    />
                </div>

                {/* Reading Timeline */}
                <section className="mb-6 rounded-lg bg-zinc-50 p-4">
                    <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
                        Reading Timeline
                    </h2>
                    <div className="space-y-3">
                        {bill.firstReadingDate && (
                            <div className="flex items-center gap-3">
                                <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                                    First Reading
                                </span>
                                <Link
                                    href={`/sessions/${bill.firstReadingSessionId}`}
                                    className="text-sm text-zinc-700 hover:text-purple-600 hover:underline"
                                >
                                    {new Date(bill.firstReadingDate).toLocaleDateString('en-SG', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </Link>
                            </div>
                        )}
                        {secondReadingTimelines.map((session, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                                    Second Reading{secondReadingTimelines.length > 1 ? ` (${idx + 1})` : ''}
                                </span>
                                <Link
                                    href={`/sessions/${session.sessionId}`}
                                    className="text-sm text-zinc-700 hover:text-purple-600 hover:underline"
                                >
                                    {new Date(session.sessionDate).toLocaleDateString('en-SG', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Speakers */}
                {uniqueSpeakers.length > 0 && (
                    <section className="mb-6">
                        <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
                            Members Involved
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {uniqueSpeakers.map((speaker) => (
                                <Link
                                    key={speaker.memberId}
                                    href={`/members/${speaker.memberId}`}
                                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm transition-colors hover:bg-purple-100 hover:text-purple-700"
                                >
                                    {speaker.name}
                                    {speaker.designation && (
                                        <span className="ml-1 text-zinc-500">
                                            ({speaker.designation})
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Second Reading Transcripts */}
                {bill.secondReadings.length > 0 && (
                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase text-zinc-500">
                                Transcript{bill.secondReadings.length > 1 ? 's' : ''}
                            </h2>
                            {bill.secondReadings[0]?.sourceUrl && (
                                <a
                                    href={bill.secondReadings[0].sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-purple-600 hover:underline"
                                >
                                    View Original Hansard ↗
                                </a>
                            )}
                        </div>

                        {bill.secondReadings.map((section, idx) => (
                            <div key={section.id} className="mb-6">
                                {bill.secondReadings.length > 1 && (
                                    <h3 className="mb-2 text-sm font-medium text-zinc-600">
                                        {new Date(section.sessionDate).toLocaleDateString('en-SG', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </h3>
                                )}
                                <div
                                    className="transcript-content prose prose-zinc max-w-none"
                                    dangerouslySetInnerHTML={{ __html: section.contentHtml }}
                                />
                                {idx < bill.secondReadings.length - 1 && (
                                    <hr className="my-6 border-zinc-200" />
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {/* No second reading yet */}
                {bill.secondReadings.length === 0 && (
                    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm italic text-amber-600">
                            This bill has not yet had its second reading.
                        </p>
                    </section>
                )}
            </article>
        </div>
    )
}
