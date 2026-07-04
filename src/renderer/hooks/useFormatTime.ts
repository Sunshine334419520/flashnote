import { useT } from '../i18n'

export function useFormatTime(): (iso: string) => string {
  const { t } = useT()
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('time.justNow')
    if (mins < 60) return t('time.minutesAgo', { n: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('time.hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('time.daysAgo', { n: days })
    return t('time.weeksAgo', { n: Math.floor(days / 7) })
  }
}
