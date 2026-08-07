/**
 * Environment-aware logger.
 *
 * Debug and info output is suppressed in production builds so the browser
 * console stays clean for real users, while warnings and errors always surface
 * because they represent conditions somebody needs to act on.
 */

import { env } from '@/config/env'

const PREFIX = '[OAC]'

/** @param {'debug'|'info'|'warn'|'error'} level */
function emit(level, args) {
  const isNoisy = level === 'debug' || level === 'info'
  if (isNoisy && !env.isDevelopment) return

  // eslint-disable-next-line no-console
  console[level](PREFIX, ...args)
}

export const logger = Object.freeze({
  debug: (...args) => emit('debug', args),
  info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
})

export default logger
