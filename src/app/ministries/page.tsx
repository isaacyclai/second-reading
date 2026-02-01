'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Ministry } from '@/types'

export default function MinistriesPage() {
    const [ministries, setMinistries] = useState<Ministry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchMinistries() {
            try {
                const res = await fetch('/api/ministries')
                const data = await res.json()
                setMinistries(data)
            } catch (error) {
                console.error('Failed to fetch ministries:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchMinistries()
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
            <header className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                    Ministries
                </h1>
                <p className="mb-4 text-zinc-600">
                    Here, you can find the motions, bills, and questions organised by which ministry they are related to. This serves
                    as a proxy for topics discussed in Parliament.
                </p>
                <p className="mb-4 text-zinc-600">
                    Note that not all proceedings in Parliament are necessarily related to a particular ministry. Furthermore, the ministry
                    affiliations are based on the identity of the Minister who answers the question or introduces the bill, which may not be
                    completely precise in all cases.
                </p>
            </header>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ministries.map((ministry) => (
                    <Link
                        key={ministry.id}
                        href={`/ministries/${ministry.id}`}
                        className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-green-300 hover:shadow-md"
                    >
                        <div className="mb-1 flex items-center gap-2">
                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                                {ministry.acronym}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                                {ministry.sectionCount || 0} sections
                            </span>
                        </div>
                        <h3 className="font-semibold text-zinc-900">
                            {ministry.name}
                        </h3>
                    </Link>
                ))}
            </div>
        </div>
    )
}
