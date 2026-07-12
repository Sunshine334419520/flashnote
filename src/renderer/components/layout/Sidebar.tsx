import type { ReactElement } from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { SearchBar } from '../search/SearchBar'
import { CategoryList } from '../categories/CategoryList'
import { Plus } from 'lucide-react'

export function Sidebar(): ReactElement {
  const { setSearchQuery, setActiveCategory, activeCategory, searchQuery } = useNoteStore()

  const handleSearch = (q: string) => {
    setSearchQuery(q)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-heading font-bold tracking-tight">FlashNote</h1>
          <button
            onClick={() => window.electronAPI.window.showQuickCapture()}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Quick Capture (Alt+Space)"
          >
            <Plus size={16} />
          </button>
        </div>
        <SearchBar value={searchQuery} onChange={handleSearch} />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <CategoryList
          activeCategory={activeCategory}
          onSelect={(cat) => setActiveCategory(cat)}
        />
      </div>

      {/* All notes shortcut */}
      <div className="px-3 pb-3">
        <button
          onClick={() => setActiveCategory(null)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-body transition-colors ${
            !activeCategory
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          All Notes
        </button>
      </div>
    </div>
  )
}
