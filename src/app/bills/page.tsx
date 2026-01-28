'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SearchBar from '@/components/SearchBar'

interface Bill {
    id: string
    title: string
    firstReadingDate: string | null
    firstReadingSessionId: string | null
    secondReadingDate: string | null
    secondReadingSessionId: string | null
    ministryId: string | null
    ministry: string | null
    ministryName: string | null
}

export default function BillsPage() {
    const [bills, setBills] = useState<Bill[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        async function fetchBills() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (search) params.set('search', search)
                params.set('limit', '100')

                const res = await fetch(`/api/bills?${params}`)
                const data = await res.json()
                setBills(data)
            } catch (error) {
                console.error('Failed to fetch bills:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchBills()
    }, [search])

    return (
        <div>
            <header className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    Bills
                </h1>
                <p className="text-zinc-600">
                    Browse parliamentary bills and their readings. (Placeholder)
                </p>
            </header>

            <div className="mb-6">
                <SearchBar
                    placeholder="Search bills..."
                    onSearch={setSearch}
                />
            </div>

            <section>
                <h2 className="mb-4 text-xl font-semibold text-zinc-900">
                    {search ? `Search Results for "${search}"` : 'Recent Bills'}
                </h2>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    </div>
                ) : bills.length === 0 ? (
                    <p className="py-12 text-center text-zinc-500">
                        {search ? 'No bills found matching your search' : 'No bills found'}
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {bills.map((bill) => (
                            <Link key={bill.id} href={`/bills/${bill.id}`}>
                                <div className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md">
                                    {/* Header */}
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        {bill.ministry && (
                                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                                {bill.ministry}
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="mb-3 line-clamp-2 font-semibold text-zinc-900 group-hover:text-purple-600">
                                        {bill.title}
                                    </h3>

                                    {/* Reading Dates */}
                                    <div className="space-y-1 text-xs text-zinc-500">
                                        {bill.firstReadingDate && (
                                            <div className="flex items-center gap-2">
                                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700">
                                                    1R
                                                </span>
                                                <span>
                                                    {new Date(bill.firstReadingDate).toLocaleDateString('en-SG', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                        {bill.secondReadingDate && (
                                            <div className="flex items-center gap-2">
                                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700">
                                                    2R
                                                </span>
                                                <span>
                                                    {new Date(bill.secondReadingDate).toLocaleDateString('en-SG', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
