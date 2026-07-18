import { type ReactElement, useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

interface Props {
  onDone: () => void
  duration?: number
}

export function LoadingScreen({ onDone, duration = 2000 }: Props): ReactElement {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 100)
    const done = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 300)
    }, duration)
    return () => { clearTimeout(show); clearTimeout(done) }
  }, [onDone, duration])

  return (
    <div className={cn(
      'h-screen flex flex-col items-center justify-center bg-background gap-8 transition-opacity duration-300',
      visible ? 'opacity-100' : 'opacity-0'
    )}>
      {/* Icon area — amber gradient shimmer */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent animate-pulse shadow-lg shadow-primary/10" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 animate-pulse"
          style={{ animationDelay: '0.5s', animationDuration: '2s' }}
        />
        {/* Inner spark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-primary/60">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-3">
        <h1 className="text-heading font-medium text-foreground tracking-wide">
          闪记
          <span className="text-caption font-normal text-muted-foreground ml-2">FlashNote</span>
        </h1>

        {/* Three loading dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
