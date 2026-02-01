'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface ServerPaginationProps {
    currentPage: number
    totalPages: number
    baseUrl: string
}

export default function ServerPagination({
    currentPage,
    totalPages,
    baseUrl
}: ServerPaginationProps) {
    const searchParams = useSearchParams()

    // Helper to generate the URL for a specific page
    const getPageUrl = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', page.toString())
        return `${baseUrl}?${params.toString()}`
    }

    const getPageNumbers = () => {
        const delta = 1 // Number of pages to show around current page
        const range = []
        const rangeWithDots: (number | string)[] = []

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i)
            }
        }

        let l: number | null = null
        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1)
                } else if (i - l !== 1) {
                    rangeWithDots.push('...')
                }
            }
            rangeWithDots.push(i)
            l = i
        }

        return rangeWithDots
    }

    if (totalPages <= 1) return null

    return (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {/* Previous Button */}
            {currentPage > 1 ? (
                <Link
                    href={getPageUrl(currentPage - 1)}
                    scroll={false}
                    className="rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium hover:bg-zinc-50"
                >
                    Previous
                </Link>
            ) : (
                <button
                    disabled
                    className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium opacity-50 bg-white"
                >
                    Previous
                </button>
            )}

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                        <span key={`dots-${index}`} className="px-2 text-zinc-400">...</span>
                    ) : (
                        <Link
                            key={page}
                            href={getPageUrl(page as number)}
                            scroll={false}
                            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                                }`}
                        >
                            {page}
                        </Link>
                    )
                ))}
            </div>

            {/* Next Button */}
            {currentPage < totalPages ? (
                <Link
                    href={getPageUrl(currentPage + 1)}
                    scroll={false}
                    className="rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium hover:bg-zinc-50"
                >
                    Next
                </Link>
            ) : (
                <button
                    disabled
                    className="cursor-not-allowed rounded-md border border-zinc-200 px-3 py-1 text-sm font-medium opacity-50 bg-white"
                >
                    Next
                </button>
            )}
        </div>
    )
}
