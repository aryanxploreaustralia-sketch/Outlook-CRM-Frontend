/**
 * Live read-source state for the UI.
 *
 * Two things a page might want to say — "you are offline" and "this came from
 * your local copy" — and one thing it might want to do: pin the source while
 * demonstrating offline behaviour on a working network.
 *
 * Nothing is required to consume this. Phase 4 wires the fallback into the data
 * hooks, which is what makes the CRM readable offline; this exists so a status
 * indicator can be added without any page reaching into `localStorage` or
 * subscribing to browser events itself.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  READ_SOURCE,
  getPreferredSource,
  isDefinitelyOffline,
  onPreferenceChange,
  setPreferredSource,
} from '@/offline/read/source.js'

/**
 * @returns {{ isOffline: boolean, preference: string, effective: string,
 *   setPreference: (source: string) => void }}
 */
export function useReadSource() {
  const [isOffline, setIsOffline] = useState(() => isDefinitelyOffline())
  const [preference, setPreference] = useState(() => getPreferredSource())

  useEffect(() => {
    /*
     * `online`/`offline` fire on the window, and are the only reliable signal
     * that connectivity changed. The state is re-read from `navigator` rather
     * than assumed from the event name, so a burst of events cannot leave this
     * disagreeing with the browser.
     */
    const sync = () => setIsOffline(isDefinitelyOffline())

    globalThis.addEventListener?.('online', sync)
    globalThis.addEventListener?.('offline', sync)
    // Covers the gap between the initial render and this effect running.
    sync()

    return () => {
      globalThis.removeEventListener?.('online', sync)
      globalThis.removeEventListener?.('offline', sync)
    }
  }, [])

  // Same-tab preference changes; `storage` events only reach other tabs.
  useEffect(() => onPreferenceChange(setPreference), [])

  const choose = useCallback((source) => setPreference(setPreferredSource(source)), [])

  /**
   * What a read would actually do right now.
   *
   * `AUTO` while offline reports `local`, which is what a badge should say —
   * the honest answer, rather than the setting's name.
   */
  const effective = preference === READ_SOURCE.AUTO
    ? (isOffline ? READ_SOURCE.LOCAL : READ_SOURCE.ONLINE)
    : preference

  return { isOffline, preference, effective, setPreference: choose }
}

export default useReadSource
