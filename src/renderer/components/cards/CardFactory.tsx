import type { ReactElement } from 'react'
import type { Note } from '../../../shared/types'
import { APIKeyCard } from './APIKeyCard'
import { CommandCard } from './CommandCard'
import { CredentialCard } from './CredentialCard'
import { BookmarkCard } from './BookmarkCard'
import { TextCard } from './TextCard'

interface CardFactoryProps {
  note: Note
}

export function CardFactory({ note }: CardFactoryProps): ReactElement {
  switch (note.type) {
    case 'apikey':
      return <APIKeyCard note={note} />
    case 'command':
      return <CommandCard note={note} />
    case 'credential':
      return <CredentialCard note={note} />
    case 'bookmark':
      return <BookmarkCard note={note} />
    default:
      return <TextCard note={note} />
  }
}
