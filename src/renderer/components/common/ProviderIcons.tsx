import type { ReactElement } from 'react'
import type { AIProviderType } from '../../../shared/types'

// SVGs imported as URLs — Vite resolves these to asset paths
import deepseekIcon from '../../assets/icons/deepseek.svg'
import anthropicIcon from '../../assets/icons/anthropic.svg'
import zhipuIcon from '../../assets/icons/Zhipu.svg'
import moonshotIcon from '../../assets/icons/kimi-icon.svg'
import openaiIcon from '../../assets/icons/open-a-i.svg'
import customIcon from '../../assets/icons/custom.svg'

/** Map AIProviderType → SVG URL + accent color. */
export const PROVIDER_META: Record<AIProviderType, { icon: string; color: string; label: string }> = {
  deepseek:    { icon: deepseekIcon,    color: '#4D6BFE', label: 'DeepSeek' },
  moonshot:    { icon: moonshotIcon,    color: '#1E80FF', label: 'Moonshot' },
  anthropic:   { icon: anthropicIcon,   color: '#CA9F7B', label: 'Anthropic' },
  openai:      { icon: openaiIcon,      color: '#10A37F', label: 'OpenAI' },
  zhipu:       { icon: zhipuIcon,       color: '#333333', label: 'Zhipu' },
  custom:      { icon: customIcon,      color: '#78716c', label: 'Custom' },
}

interface Props {
  type: AIProviderType
  size?: number
  className?: string
}

/** Renders an AI provider SVG icon with proper sizing. */
export function ProviderIcon({ type, size = 16, className }: Props): ReactElement {
  const meta = PROVIDER_META[type] ?? PROVIDER_META.custom
  return (
    <img
      src={meta.icon}
      alt={meta.label}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
