// Centralized icon asset imports — one place, all sizes.
// Icons are kept within the renderer source tree so Vite resolves them reliably
// on all platforms in both dev and production builds.
import icon16 from './icons/icon_16x16.png'
import icon32 from './icons/icon_32x32.png'
import icon64 from './icons/icon_64x64.png'

export const ICONS = {
  /** 16×16 tray / inline icon */
  icon16,
  /** 32×32 tray @2x */
  icon32,
  /** 64×64 — search bar (sharp at 15px display) */
  icon64,
} as const
