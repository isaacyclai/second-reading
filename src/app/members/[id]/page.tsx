'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import QuestionCard from '@/components/QuestionCard'
import type { Section } from '@/types'

interface Bill {
    billId: string
    sectionType: string
    sectionTitle: string
    ministry: string | null
    sessionDate: string
}

interface MemberDetail {
    id: string
    name: string
    summary: string | null
    constituency: string | null
    designation: string | null
    questions: Section[]
    bills: Bill[]
}

export default function MemberDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const [member, setMember] = useState<MemberDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchMember() {
            try {
                const res = await fetch(`/api/members/${id}`)
                if (!res.ok) throw new Error('Member not found')
                const data = await res.json()
                setMember(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load member')
            } finally {
                setLoading(false)
            }
        }
        fetchMember()
    }, [id])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        )
    }

    if (error || !member) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500">{error || 'Member not found'}</p>
            </div>
        )
    }

    return (
        <div>
            <Link href="/members" className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline dark:text-blue-400">
                ← Back to Members
            </Link>

            <section className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
                    {member.name}
                </h1>
                {(member.designation || member.constituency) && (
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                        {member.designation && (
                            <span className="text-lg text-zinc-600 dark:text-zinc-400">
                                {member.designation}
                            </span>
                        )}
                        {member.constituency && (
                            <span className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {member.constituency}
                            </span>
                        )}
                    </div>
                )}
                {member.summary && (
                    <p className="text-zinc-600 dark:text-zinc-400">
                        {member.summary}
                    </p>
                )}
            </section>

            {/* Bills Section */}
            {member.bills && member.bills.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-white">
                        Bills ({member.bills.length})
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {member.bills.map((bill) => (
                            <Link key={bill.billId} href={`/bills/${bill.billId}`}>
                                <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-700">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                            Bill
                                        </span>
                                        {bill.ministry && (
                                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                {bill.ministry}
                                            </span>
                                        )}
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
                    Parliamentary Questions ({member.questions?.length || 0})
                </h2>
                {!member.questions || member.questions.length === 0 ? (
                    <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                        No recorded questions
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {member.questions.map((question) => (
                            <QuestionCard key={question.id} question={question} showSpeakers={false} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
