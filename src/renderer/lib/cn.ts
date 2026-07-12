import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Register our custom typography tokens (defined in globals.css @theme) as
// font-size classes. Without this, tailwind-merge mistakes text-micro/caption/…
// for text-COLOR utilities and strips them when they're merged with a real color
// class inside cn() (e.g. the card copy button) — dropping the font size.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'label', 'body', 'title', 'heading'] }]
    }
  }
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
