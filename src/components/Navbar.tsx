'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback } from 'react'

// Map routes to their API endpoints for prefetching
const prefetchMap: Record<string, string> = {
    '/sessions': '/api/sessions?page=1&limit=20',
    '/questions': '/api/sections?limit=50',
    '/bills': '/api/bills?limit=50',
    '/members': '/api/members?page=1&limit=20',
    '/ministries': '/api/ministries',
}

export default function Navbar() {
    const pathname = usePathname()

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/sessions', label: 'Sessions' },
        { href: '/questions', label: 'Questions' },
        { href: '/bills', label: 'Bills' },
        { href: '/members', label: 'MPs' },
        { href: '/ministries', label: 'Ministries' },
    ]

    // Prefetch API data on hover to warm the cache
    const handlePrefetch = useCallback((href: string) => {
        const apiUrl = prefetchMap[href]
        if (apiUrl) {
            // Use fetch with low priority to prefetch without blocking
            fetch(apiUrl, { priority: 'low' as RequestPriority }).catch(() => { })
        }
    }, [])

    return (
        <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
                <Link href="/" className="text-xl font-bold text-zinc-900">
                    🇸🇬 Parliament
                </Link>
                <div className="flex items-center gap-6">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onMouseEnter={() => handlePrefetch(link.href)}
                            className={`text-sm font-medium transition-colors ${pathname === link.href
                                ? 'text-blue-600'
                                : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    )
}
