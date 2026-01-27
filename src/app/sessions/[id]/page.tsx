'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import QuestionCard from '@/components/QuestionCard'
import type { Section } from '@/types'

// Helper to format ordinal numbers (1st, 2nd, 3rd, etc.)
function getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}

interface Attendee {
    id: string
    name: string
    present: boolean
    constituency: string | null
    designation: string | null
}

interface SessionDetail {
    id: string
    date: string
    sittingNo: number
    parliament: number
    sessionNo: number
    volumeNo: number
    format: string
    url: string
    summary: string | null
    questions: Section[]
    bills: Array<{
        billId: string
        sectionTitle: string
        ministry: string | null
        ministryId: string | null
        readingTypes: string[]
        sectionOrder: number
    }>
    attendees: Attendee[]
}

export default function SessionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const [session, setSession] = useState<SessionDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAttendance, setShowAttendance] = useState(false)

    useEffect(() => {
        async function fetchSession() {
            try {
                const res = await fetch(`/api/sessions/${id}`)
                if (!res.ok) throw new Error('Session not found')
                const data = await res.json()
                setSession(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load session')
            } finally {
                setLoading(false)
            }
        }
        fetchSession()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    if (error || !session) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500">{error || 'Session not found'}</p>
                <Link href="/sessions" className="mt-4 text-blue-500 hover:underline">
                    ← Back to Sessions
                </Link>
            </div>
        )
    }

    const presentMembers = session.attendees?.filter(a => a.present) || []
    const absentMembers = session.attendees?.filter(a => !a.present) || []

    return (
        <div>
            <Link href="/sessions" className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline dark:text-blue-400">
                ← Back to Sessions
            </Link>

            <header className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
                    {new Date(session.date).toLocaleDateString('en-SG', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </h1>
                <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span>{getOrdinal(session.parliament)} Parliament</span>
                    <span>•</span>
                    <span>{getOrdinal(session.sessionNo)} Session</span>
                    <span>•</span>
                    <span>{getOrdinal(session.sittingNo)} Sitting</span>
                    {session.url && (
                        <>
                            <span>•</span>
                            <a
                                href={session.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Full report from Hansard ↗
                            </a>
                        </>
                    )}
                </div>
            </header>

            {/* Session Summary */}
            {session.summary ? (
                <section className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase text-blue-700 dark:text-blue-400">
                            Session Summary
                        </h2>
                        <span className="text-xs text-blue-500 dark:text-blue-400">✨ AI Generated</span>
                    </div>
                    <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                        {session.summary}
                    </p>
                </section>
            ) : (
                <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm italic text-amber-600 dark:text-amber-400">
                        Session summary will be generated in a future update.
                    </p>
                </section>
            )}

            {/* Attendance */}
            {session.attendees && session.attendees.length > 0 && (
                <section className="mb-8">
                    <button
                        onClick={() => setShowAttendance(!showAttendance)}
                        className="mb-4 flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-white"
                    >
                        <span>Members ({presentMembers.length} present, {absentMembers.length} absent)</span>
                        <svg
                            className={`h-5 w-5 transition-transform ${showAttendance ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showAttendance && (
                        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                            {/* Present */}
                            <div className="mb-4">
                                <h3 className="mb-2 text-sm font-semibold uppercase text-green-600 dark:text-green-400">
                                    Present ({presentMembers.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {presentMembers.map((member) => (
                                        <Link
                                            key={member.id}
                                            href={`/members/${member.id}`}
                                            className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                                        >
                                            {member.name}
                                            {member.designation && (
                                                <span className="ml-1 text-green-500 dark:text-green-500">
                                                    ({member.designation})
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Absent */}
                            {absentMembers.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                                        Absent ({absentMembers.length})
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {absentMembers.map((member) => (
                                            <Link
                                                key={member.id}
                                                href={`/members/${member.id}`}
                                                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                            >
                                                {member.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Bills */}
            {session.bills && session.bills.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">
                        Bills ({session.bills.length})
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {session.bills.map((bill) => (
                            <Link key={bill.billId} href={`/bills/${bill.billId}`}>
                                <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-700">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        {bill.readingTypes?.includes('BI') && (
                                            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                                1st Reading
                                            </span>
                                        )}
                                        {bill.readingTypes?.includes('BP') && (
                                            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                                2nd Reading
                                            </span>
                                        )}
                                        {bill.ministry && (
                                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                {bill.ministry}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="line-clamp-2 font-semibold text-zinc-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                                        {bill.sectionTitle}
                                    </h3>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Questions */}
            <section>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">
                    Questions ({session.questions.length})
                </h2>
                {session.questions.length === 0 ? (
                    <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                        No questions in this session
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {session.questions.map((question) => (
                            <QuestionCard key={question.id} question={question} showDate={false} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
