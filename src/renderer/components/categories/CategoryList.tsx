import { type ReactElement, useMemo } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { CategoryItem } from './CategoryItem'
import { FolderOpen } from 'lucide-react'

interface CategoryListProps {
  activeCategory: string | null
  onSelect: (category: string | null) => void
}

export function CategoryList({ activeCategory, onSelect }: CategoryListProps): ReactElement {
  const notes = useNoteStore((s) => s.notes)
  const isLoading = useNoteStore((s) => s.isLoading)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) {
      counts.set(n.category, (counts.get(n.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [notes])

  if (isLoading && categories.length === 0) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
        <FolderOpen size={28} className="mb-2 opacity-40" />
        <p className="text-label">No notes yet</p>
        <p className="text-caption mt-0.5">Press Alt+Space to capture</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <p className="px-3 mb-1.5 text-caption font-medium text-muted-foreground/60 uppercase tracking-wider">
        Categories
      </p>
      {categories.map((cat) => (
        <CategoryItem
          key={cat.name}
          name={cat.name}
          count={cat.count}
          isActive={activeCategory === cat.name}
          onClick={() => onSelect(activeCategory === cat.name ? null : cat.name)}
        />
      ))}
    </div>
  )
}
