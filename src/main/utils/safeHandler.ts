import { logger } from './logger'

/**
 * Wrap an IPC handler so that any thrown error is logged to file + console.
 * The renderer always gets a proper Error with message instead of a crash.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeHandler<T extends (...args: any[]) => any>(
  channel: string,
  fn: T
): T {
  const wrapped = (...args: Parameters<T>): ReturnType<T> => {
    try {
      const result = fn(...args)
      if (result instanceof Promise) {
        return result.catch((err: Error) => {
          logger.error(`ipc:${channel}`, err.message, { stack: err.stack })
          throw new Error(err.message ?? 'IPC error')
        }) as ReturnType<T>
      }
      return result
    } catch (err) {
      const error = err as Error
      logger.error(`ipc:${channel}`, error.message, { stack: error.stack })
      throw new Error(error.message ?? 'IPC error')
    }
  }
  return wrapped as T
}
