'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Session {
    id: string
    date: string
    sittingNo: number
    parliament: number
    sessionNo: number
    volumeNo: number
    format: string
    url: string
    summary: string | null
    questionCount: number
}

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchSessions() {
            try {
                const res = await fetch('/api/sessions')
                const data = await res.json()
                setSessions(data)
            } catch (error) {
                console.error('Failed to fetch sessions:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchSessions()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    return (
        <div>
            <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-white">
                Parliament Sessions
            </h1>
            <div className="grid gap-4">
                {sessions.map((session) => (
                    <Link
                        key={session.id}
                        href={`/sessions/${session.id}`}
                        className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
                    >
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                                {new Date(session.date).toLocaleDateString('en-SG', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </span>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                Sitting {session.sittingNo}
                            </span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {session.questionCount} questions
                            </span>
                        </div>
                        {session.summary && (
                            <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                                {session.summary}
                            </p>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    )
}
