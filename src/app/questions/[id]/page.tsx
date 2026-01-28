'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import AISummaryCard from '@/components/AISummaryCard'
import type { Section, Speaker } from '@/types'

const QUESTION_TYPE_LABELS: Record<string, string> = {
    'OA': 'Oral Answer to Oral Question',
    'WA': 'Written Answer',
    'WANA': 'Written Answer to Oral Question not answered by end of Question Time',
    'OS': 'Motion',
    'BP': 'Bill',
}

interface QuestionDetail extends Section {
    ministryName?: string
}

export default function QuestionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const [question, setQuestion] = useState<QuestionDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchQuestion() {
            try {
                const res = await fetch(`/api/questions/${id}`)
                if (!res.ok) throw new Error('Question not found')
                const data = await res.json()
                setQuestion(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load question')
            } finally {
                setLoading(false)
            }
        }
        fetchQuestion()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    if (error || !question) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500">{error || 'Question not found'}</p>
                <Link href="/" className="mt-4 text-blue-500 hover:underline">
                    ← Back to Home
                </Link>
            </div>
        )
    }

    const typeLabel = QUESTION_TYPE_LABELS[question.sectionType] || question.sectionType
    const speakers = Array.isArray(question.speakers) ? question.speakers : []

    const isMotion = question.category === 'motion' || question.category === 'statement' || (!question.category && question.sectionType === 'OS')
    const isBill = ['BP', 'BI'].includes(question.sectionType)

    let badgeColorClass = "bg-blue-100 text-blue-700"
    if (isMotion) badgeColorClass = "bg-pink-100 text-pink-700"
    else if (isBill) badgeColorClass = "bg-purple-100 text-purple-700"

    return (
        <div className="mx-auto max-w-4xl">
            <Link href={`/sessions/${question.sessionId}`} className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline">
                ← Back to Session
            </Link>

            <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                {/* Header */}
                <header className="mb-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        {!['adjournment_motion', 'clarification'].includes(question.category || '') && (
                            <span className={`rounded px-3 py-1 text-sm font-medium ${badgeColorClass}`}>
                                {typeLabel}
                            </span>
                        )}
                        {question.ministry && question.ministryId && (
                            <Link
                                href={`/ministries/${question.ministryId}`}
                                className="rounded bg-green-100 px-3 py-1 text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
                            >
                                {question.ministryName || question.ministry}
                            </Link>
                        )}
                        {question.category === 'adjournment_motion' && (
                            <span className="rounded bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                                Adjournment Motion
                            </span>
                        )}
                        {question.category === 'clarification' && (
                            <span className="rounded bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                                Clarification
                            </span>
                        )}
                        <Link
                            href={`/sessions/${question.sessionId}`}
                            className="text-sm text-zinc-500 transition-colors hover:text-blue-600 hover:underline"
                        >
                            {new Date(question.sessionDate).toLocaleDateString('en-SG', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900">
                        {question.sectionTitle}
                    </h1>
                </header>

                {/* Speakers */}
                {speakers.length > 0 && (
                    <section className="mb-6">
                        <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-500">
                            Speakers
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {speakers.map((speaker, i) => {
                                const s = speaker as Speaker
                                return (
                                    <Link
                                        key={i}
                                        href={`/members/${s.memberId}`}
                                        className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 transition-colors hover:bg-zinc-200"
                                    >
                                        {s.name}
                                        {s.designation && (
                                            <span className="ml-1 text-zinc-500">({s.designation})</span>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Summary */}
                <div className="mb-6">
                    <AISummaryCard
                        title={question.category === 'question' ? "Question Summary" : "Summary"}
                        content={question.summary}
                        fallbackMessage="Summary will be added in a future update."
                    />
                </div>

                {/* Full Content */}
                <section>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase text-zinc-500">
                            Full Transcript
                        </h2>
                        {question.sourceUrl && (
                            <a
                                href={question.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                            >
                                View Original Hansard ↗
                            </a>
                        )}
                    </div>
                    <div
                        className="transcript-content prose prose-zinc max-w-none"
                        dangerouslySetInnerHTML={{ __html: question.contentHtml }}
                    />
                </section>
            </article>
        </div>
    )
}
