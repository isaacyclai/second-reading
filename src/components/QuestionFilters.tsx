'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import SearchBar from '@/components/SearchBar'

export default function QuestionFilters({
    initialSearch = ''
}: {
    initialSearch?: string
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleSearch = (query: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (query) params.set('search', query)
        else params.delete('search')

        router.push(`/questions?${params.toString()}`)
    }

    return (
        <div className="mb-6">
            <SearchBar
                placeholder="Search questions..."
                onSearch={handleSearch}
                defaultValue={initialSearch}
            />
        </div>
    )
}
