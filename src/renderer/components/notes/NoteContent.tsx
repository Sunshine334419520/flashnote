import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'

interface NoteContentProps {
  content: string
}

export function NoteContent({ content }: NoteContentProps): ReactElement {
  if (!content.trim()) {
    return <p className="text-muted-foreground/50 italic text-sm">Empty note</p>
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted/50 prose-code:text-sm prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted/50">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
