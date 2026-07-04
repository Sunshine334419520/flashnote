import type { ReactElement } from 'react'
import type { Note } from '../../../shared/types'
import { APIKeyCard } from './APIKeyCard'
import { CommandCard } from './CommandCard'
import { CredentialCard } from './CredentialCard'
import { BookmarkCard } from './BookmarkCard'
import { TextCard } from './TextCard'

interface CardFactoryProps {
  note: Note
  onUpdate?: (id: string, title: string, content: string) => void
  onDelete?: (id: string) => void
}

export function CardFactory({ note, onUpdate, onDelete }: CardFactoryProps): ReactElement {
  switch (note.type) {
    case 'apikey':
      return <APIKeyCard note={note} onUpdate={onUpdate} onDelete={onDelete} />
    case 'command':
      return <CommandCard note={note} onUpdate={onUpdate} onDelete={onDelete} />
    case 'credential':
      return <CredentialCard note={note} onUpdate={onUpdate} onDelete={onDelete} />
    case 'bookmark':
      return <BookmarkCard note={note} onUpdate={onUpdate} onDelete={onDelete} />
    default:
      return <TextCard note={note} onUpdate={onUpdate} onDelete={onDelete} />
  }
}
