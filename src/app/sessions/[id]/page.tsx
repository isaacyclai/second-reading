'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import QuestionCard from '@/components/QuestionCard'
import type { Section } from '@/types'

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
                    <span>Parliament {session.parliament}</span>
                    <span>•</span>
                    <span>Session {session.sessionNo}</span>
                    <span>•</span>
                    <span>Sitting {session.sittingNo}</span>
                    {session.url && (
                        <>
                            <span>•</span>
                            <a
                                href={session.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Official Record ↗
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
