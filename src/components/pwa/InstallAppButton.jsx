/**
 * "Install app", shown only when the browser will actually install it.
 *
 * ## It renders nothing unless it can do something
 *
 * The button appears only after Chromium has fired `beforeinstallprompt`, which
 * it does when it has checked the manifest, the icons, the scope and the secure
 * context and decided the app is installable. So the control cannot be offered
 * on Safari or Firefox, cannot be offered to somebody who already installed it,
 * and cannot be offered when something in the manifest is wrong.
 *
 * That is the whole reason it is driven by the event rather than by a feature
 * check: a button that "installs" by opening a bookmark dialog, or that sits
 * there doing nothing on an unsupported browser, is worse than no button.
 *
 * ## The prompt can only be used once
 *
 * The saved event is consumed by `prompt()`. Whatever the reader chooses, it is
 * discarded afterwards and the button goes away — calling it twice throws, and
 * Chromium fires a fresh event on a later visit if the app is still installable.
 */

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/Button'

export function InstallAppButton({ className = '' }) {
  const [promptEvent, setPromptEvent] = useState(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    const onAvailable = (event) => {
      // Chromium shows its own mini-infobar unless this is prevented; the
      // address-bar install icon stays either way, so nothing is taken away.
      event.preventDefault()
      setPromptEvent(event)
    }

    // Fired after an install completes by any route, including Chrome's own
    // address-bar button — so the offer disappears however it was accepted.
    const onInstalled = () => setPromptEvent(null)

    window.addEventListener('beforeinstallprompt', onAvailable)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!promptEvent) return null

  const install = async () => {
    setIsBusy(true)

    try {
      await promptEvent.prompt()
      await promptEvent.userChoice
    } catch (error) {
      console.warn('[pwa] Install prompt failed.', error)
    } finally {
      // Spent either way: the event cannot be reused, and Chromium will send a
      // new one on a later visit if the app is still installable.
      setPromptEvent(null)
      setIsBusy(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={install}
      isLoading={isBusy}
      className={`hidden lg:inline-flex ${className}`}
      title="Install Xplore Australia CRM as an app"
    >
      <Download className="size-3.5" aria-hidden="true" />
      Install app
    </Button>
  )
}

export default InstallAppButton
