import ReactMarkdown from 'react-markdown'

interface AISummaryCardProps {
    title: string
    content: string | null | undefined
    fallbackMessage?: string
    className?: string
}

export default function AISummaryCard({
    title,
    content,
    fallbackMessage = "Summary has not been generated yet.",
    className = ""
}: AISummaryCardProps) {
    if (!content) {
        return (
            <section className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className}`}>
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase text-amber-700">
                        {title}
                    </h2>
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        Pending Generation
                    </span>
                </div>
                <p className="text-sm italic text-amber-600">
                    {fallbackMessage}
                </p>
            </section>
        )
    }

    return (
        <section className={`rounded-lg border border-blue-200 bg-blue-50 p-5 ${className}`}>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-blue-700">
                    {title}
                </h2>
                <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2 py-0.5 shadow-sm">
                    <span className="animate-pulse text-indigo-500">✨</span>
                    <span className="text-xs font-medium text-blue-600">AI Generated</span>
                </div>
            </div>
            <div className="text-zinc-700">
                <ReactMarkdown
                    components={{
                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 mb-4" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-2 mb-4" {...props} />,
                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-zinc-900" {...props} />,
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </section>
    )
}
