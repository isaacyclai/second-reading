'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import QuestionCard from '@/components/QuestionCard'
import type { Section } from '@/types'

interface Bill {
    billId: string
    sectionType: string
    sectionTitle: string
    sessionDate: string
}

interface MinistryDetail {
    id: string
    name: string
    acronym: string
    questions: Section[]
    bills: Bill[]
}

export default function MinistryDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const [ministry, setMinistry] = useState<MinistryDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchMinistry() {
            try {
                const res = await fetch(`/api/ministries/${id}`)
                if (!res.ok) throw new Error('Ministry not found')
                const data = await res.json()
                setMinistry(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load ministry')
            } finally {
                setLoading(false)
            }
        }
        fetchMinistry()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    if (error || !ministry) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500">{error || 'Ministry not found'}</p>
            </div>
        )
    }

    return (
        <div>
            <Link href="/ministries" className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline dark:text-blue-400">
                ← Back to Ministries
            </Link>

            <section className="mb-8">
                <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-green-100 px-3 py-1 text-sm font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {ministry.acronym}
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {ministry.name}
                </h1>
            </section>

            {/* Bills Section */}
            {ministry.bills && ministry.bills.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">
                        Bills ({ministry.bills.length})
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {ministry.bills.map((bill) => (
                            <Link key={bill.billId} href={`/bills/${bill.billId}`}>
                                <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-700">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                            Bill
                                        </span>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {new Date(bill.sessionDate).toLocaleDateString('en-SG', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
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

            {/* Questions Section */}
            <section>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">
                    Related Questions ({ministry.questions?.length || 0})
                </h2>
                {!ministry.questions || ministry.questions.length === 0 ? (
                    <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                        No questions found for this ministry
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {ministry.questions.map((question) => (
                            <QuestionCard key={question.id} question={question} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
