// Centralized icon asset imports — one place, all sizes.
// Switch between v1/v2 by changing the version folder in the import paths.
import icon16 from '../../../assets/icons/v2/icon_16x16.png'
import icon32 from '../../../assets/icons/v2/icon_32x32.png'
import icon64 from '../../../assets/icons/v2/icon_64x64.png'

export const ICONS = {
  /** 16×16 tray / inline icon */
  icon16,
  /** 32×32 tray @2x */
  icon32,
  /** 64×64 — search bar (sharp at 15px display) */
  icon64,
} as const
