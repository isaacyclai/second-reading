'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import QuestionCard from '@/components/QuestionCard'
import SearchBar from '@/components/SearchBar'
import AISummaryCard from '@/components/AISummaryCard'
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
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        async function fetchMember() {
            try {
                const params = new URLSearchParams()
                if (searchQuery) params.set('search', searchQuery)

                const res = await fetch(`/api/members/${id}?${params}`)
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
    }, [id, searchQuery])

    // Use member data directly as it's now filtered on the server
    const filteredBills = member?.bills || []
    const allQuestions = member?.questions || []

    const motions = allQuestions.filter(q =>
        ['motion', 'statement', 'adjournment_motion', 'clarification'].includes(q.category || '') ||
        (!q.category && q.sectionType === 'OS')
    )
    const questions = allQuestions.filter(q => !motions.includes(q))

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
            <Link href="/members" className="mb-6 inline-flex items-center text-sm text-blue-600 hover:underline">
                ← Back to Members
            </Link>

            <section className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    {member.name}
                </h1>
                {(member.designation || member.constituency) && (
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                        {member.designation && (
                            <span className="text-lg text-zinc-600">
                                {member.designation}
                            </span>
                        )}
                        {member.constituency && (
                            <span className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-600">
                                {member.constituency}
                            </span>
                        )}
                    </div>
                )}

                {/* Member Summary */}
                <div className="mt-6">
                    <AISummaryCard
                        title="Summary of Recent Topics"
                        content={member.summary}
                        fallbackMessage="Summary of recent topics has not been generated yet."
                    />
                </div>
            </section>

            <div className="mb-8">
                <SearchBar
                    placeholder="Search bills and questions..."
                    onSearch={setSearchQuery}
                    defaultValue={searchQuery}
                />
            </div>

            {/* Motions Section */}
            {motions.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                        Motions ({motions.length})
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {motions.map((motion) => (
                            <QuestionCard key={motion.id} question={motion} showSpeakers={false} />
                        ))}
                    </div>
                </section>
            )}

            {/* Bills Section */}
            {filteredBills.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                        Bills ({filteredBills.length})
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {filteredBills.map((bill) => (
                            <Link key={bill.billId} href={`/bills/${bill.billId}`}>
                                <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                            Bill
                                        </span>
                                        {bill.ministry && (
                                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                {bill.ministry}
                                            </span>
                                        )}
                                        <span className="text-xs text-zinc-500">
                                            {new Date(bill.sessionDate).toLocaleDateString('en-SG', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                    <h3 className="line-clamp-2 font-semibold text-zinc-900 group-hover:text-purple-600">
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
                <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                    Parliamentary Questions ({questions.length || 0})
                </h2>
                {questions.length === 0 ? (
                    <p className="py-8 text-center text-zinc-500">
                        {searchQuery ? 'No results found matching your search' : 'No recorded questions'}
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {questions.map((question) => (
                            <QuestionCard key={question.id} question={question} showSpeakers={false} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
