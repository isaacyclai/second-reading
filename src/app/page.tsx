import Link from 'next/link'
import { query } from '@/lib/db'

// Helper to format ordinal numbers
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default async function Home() {
  // Fetch latest 3 sessions
  const result = await query(
    `SELECT id, date, parliament, session_no, sitting_no 
     FROM sessions 
     ORDER BY date DESC 
     LIMIT 3`
  )
  const latestSessions = result.rows
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-white py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
              Making Parliament <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Accessible for All
              </span>
            </h1>
            <p className="mb-10 text-xl leading-relaxed text-zinc-600">
              Scribe makes it easier to find out what's happening in Singapore's Parliament.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/sessions"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/30"
              >
                Browse Sittings
              </Link>
              <Link
                href="/members"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-6 py-3 text-base font-semibold text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
              >
                Find Your MP
              </Link>
            </div>
          </div>
        </div>

        {/* Background decorative blob */}
        <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl opacity-30">
          <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }} />
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-zinc-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-zinc-900">Explore Data</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/motions" className="group flex flex-col items-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-blue-500/50">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-center text-lg font-semibold text-zinc-900">Motions</h3>
              <p className="text-sm text-zinc-600">What topics are being debated?</p>
            </Link>

            <Link href="/bills" className="group flex flex-col items-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-blue-500/50">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900">Bills</h3>
              <p className="text-sm text-zinc-600">What bills might be passed into law?</p>
            </Link>

            <Link href="/questions" className="group flex flex-col items-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-blue-500/50">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900">Questions</h3>
              <p className="text-sm text-zinc-600">What are the tough questions being asked?</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Updates */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-zinc-900">Latest Sittings</h2>
            <Link href="/sessions" className="text-blue-600 hover:text-blue-800 font-medium">View all</Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {latestSessions.map((session: any) => (
              <Link key={session.id} href={`/sessions/${session.id}`} className="block h-full">
                <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Sitting Report
                    </span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-zinc-900">
                    {new Date(session.date).toLocaleDateString('en-SG', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </h3>
                  <div className="mt-auto text-sm text-zinc-500">
                    {getOrdinal(session.parliament)} Parliament<br />
                    {getOrdinal(session.session_no)} Session<br />
                    {getOrdinal(session.sitting_no)} Sitting
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* About / Info */}
      <section className="bg-zinc-900 py-12 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-2xl font-semibold">About Scribe</h2>
          <p className="mx-auto max-w-2xl text-zinc-400">
            Data is sourced from the official <a href="https://sprs.parl.gov.sg/search/#/home" className="underline hover:text-white" target="_blank" rel="noreferrer">Hansard</a>.
            Scribe is an independent project and is not affiliated with the Singapore Government in any way.
          </p>
        </div>
      </section>
    </div>
  )
}
