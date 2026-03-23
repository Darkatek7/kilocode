import { type Component, Show, createSignal, onMount, onCleanup } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Card } from "@opencode-ai/ui/card"
import { Dialog } from "@opencode-ai/ui/dialog"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Spinner } from "@opencode-ai/ui/spinner"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"

type DeviceAuthState = "initiating" | "pending" | "success" | "error" | "cancelled"

const DEFAULT_EXPIRY = 900

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export const DialogDeviceAuth: Component<{
  onSuccess: () => void
  onCancel: () => void
}> = (props) => {
  const globalSDK = useGlobalSDK()
  const platform = usePlatform()
  const language = useLanguage()

  const [state, setState] = createSignal<DeviceAuthState>("initiating")
  const [verificationUrl, setVerificationUrl] = createSignal<string>("")
  const [code, setCode] = createSignal<string>("")
  const [expiresIn, setExpiresIn] = createSignal(DEFAULT_EXPIRY)
  const [error, setError] = createSignal<string>("")
  const [timeRemaining, setTimeRemaining] = createSignal(DEFAULT_EXPIRY)

  let pollTimer: ReturnType<typeof setInterval> | undefined
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  const clearTimers = () => {
    if (pollTimer) clearInterval(pollTimer)
    if (countdownTimer) clearInterval(countdownTimer)
  }

  onCleanup(clearTimers)

  const parseInstructions = (instructions: string): { url: string; code: string } => {
    const urlMatch = instructions.match(/https?:\/\/[^\s]+/)
    const codeMatch = instructions.match(/[\dA-Z]{4,}/)
    return {
      url: urlMatch ? urlMatch[0] : "",
      code: codeMatch ? codeMatch[0] : "",
    }
  }

  const pollCallback = async () => {
    try {
      const result = await globalSDK.client.provider.oauth
        .callback({ providerID: "kilo", method: 0 })
        .then((v) => (v.error ? { ok: false as const, error: v.error } : { ok: true as const }))
        .catch((e) => ({ ok: false as const, error: e }))
      if (result.ok) {
        clearTimers()
        setState("success")
        await globalSDK.client.global.dispose()
        props.onSuccess()
        return
      }
    } catch {
      // continue polling
    }
  }

  const startPolling = (intervalMs = 2000) => {
    pollTimer = setInterval(pollCallback, intervalMs)
  }

  const startCountdown = (total: number) => {
    setTimeRemaining(total)
    countdownTimer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearTimers()
          setState("cancelled")
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleRetry = () => {
    clearTimers()
    setError("")
    setState("initiating")
    void startAuth()
  }

  const handleCancel = () => {
    clearTimers()
    props.onCancel()
  }

  const startAuth = async () => {
    setState("initiating")
    try {
      const result = await globalSDK.client.provider.oauth.authorize(
        { providerID: "kilo", method: 0 },
        { throwOnError: true },
      )
      const auth = result.data
      if (!auth) throw new Error("No authorization data")

      const { url, code: deviceCode } = parseInstructions(auth.instructions ?? auth.url)
      setVerificationUrl(url || auth.url)
      setCode(deviceCode)
      setExpiresIn(DEFAULT_EXPIRY)
      setTimeRemaining(DEFAULT_EXPIRY)
      setState("pending")

      platform.openLink(auth.url)

      startPolling()
      startCountdown(DEFAULT_EXPIRY)
    } catch (err) {
      clearTimers()
      setError(err instanceof Error ? err.message : String(err))
      setState("error")
    }
  }

  onMount(() => {
    void startAuth()
  })

  const handleCopyUrl = () => {
    const url = verificationUrl()
    if (url) {
      navigator.clipboard.writeText(url)
      showToast({ variant: "success", title: language.t("deviceAuth.toast.urlCopied") })
    }
  }

  const handleCopyCode = () => {
    const c = code()
    if (c) {
      navigator.clipboard.writeText(c)
      showToast({ variant: "success", title: language.t("deviceAuth.toast.codeCopied") })
    }
  }

  const handleOpenBrowser = () => {
    const url = verificationUrl()
    if (url) platform.openLink(url)
  }

  return (
    <Dialog
      title={
        <IconButton
          tabIndex={-1}
          icon="close"
          variant="ghost"
          onClick={handleCancel}
          aria-label={language.t("common.close")}
        />
      }
    >
      <div class="flex flex-col gap-4 px-2.5 pb-3">
        <div class="px-2.5 flex gap-4 items-center">
          <div class="text-16-medium text-text-strong">{language.t("deviceAuth.title")}</div>
        </div>

        <Show when={state() === "initiating"}>
          <Card>
            <div class="flex items-center gap-3">
              <Spinner />
              <span class="text-13-regular text-text-base">{language.t("deviceAuth.status.initiating")}</span>
            </div>
          </Card>
        </Show>

        <Show when={state() === "pending"}>
          <Card>
            <div class="flex flex-col gap-4">
              <div>
                <p class="text-11-uppercase tracking-wide text-text-base mb-2">{language.t("deviceAuth.step1")}</p>
                <div class="flex gap-2 items-center">
                  <div class="flex-1 min-w-0">
                    <p class="text-12-regular text-text-base truncate font-mono bg-bg-subtle p-2 rounded border border-border-base">
                      {verificationUrl()}
                    </p>
                  </div>
                  <Button variant="secondary" size="small" onClick={handleCopyUrl}>
                    📋
                  </Button>
                  <Button variant="secondary" size="small" onClick={handleOpenBrowser}>
                    ↗
                  </Button>
                </div>
              </div>

              <Show when={code()}>
                <div>
                  <p class="text-11-uppercase tracking-wide text-text-base mb-2">{language.t("deviceAuth.step2")}</p>
                  <div
                    class="flex flex-col items-center gap-1 p-4 rounded border-2 border-focus-base cursor-pointer bg-bg-subtle"
                    onClick={handleCopyCode}
                    title={language.t("deviceAuth.action.clickToCopy")}
                  >
                    <span class="text-24-semibold font-mono tracking-widest text-text-strong">{code()}</span>
                    <span class="text-11-regular text-text-base">{language.t("deviceAuth.action.clickToCopy")}</span>
                  </div>
                </div>
              </Show>

              <div class="flex items-center justify-center gap-2">
                <Spinner class="size-3" />
                <span class="text-12-regular text-text-base">
                  {language.t("deviceAuth.status.waiting")} ({formatTime(timeRemaining())})
                </span>
              </div>

              <Button variant="ghost" onClick={handleCancel}>
                {language.t("common.cancel")}
              </Button>
            </div>
          </Card>
        </Show>

        <Show when={state() === "success"}>
          <Card>
            <div class="flex flex-col items-center gap-2 py-4">
              <span class="text-24">✅</span>
              <p class="text-14-medium text-text-strong">{language.t("deviceAuth.status.success")}</p>
            </div>
          </Card>
        </Show>

        <Show when={state() === "error"}>
          <Card variant="error">
            <div class="flex flex-col gap-3">
              <div class="flex items-start gap-2">
                <span class="text-24">❌</span>
                <div class="flex flex-col gap-1 flex-1">
                  <p class="text-14-medium text-text-strong">{language.t("deviceAuth.status.failed")}</p>
                  <Show when={error()}>
                    <p class="text-12-regular text-text-base">{error()}</p>
                  </Show>
                </div>
              </div>
              <div class="flex gap-2">
                <Button variant="primary" onClick={handleRetry}>
                  {language.t("common.retry")}
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  {language.t("common.cancel")}
                </Button>
              </div>
            </div>
          </Card>
        </Show>

        <Show when={state() === "cancelled"}>
          <Card>
            <div class="flex flex-col gap-3">
              <p class="text-13-regular text-text-base">{language.t("deviceAuth.status.cancelled")}</p>
              <Button variant="primary" onClick={handleRetry}>
                {language.t("deviceAuth.action.tryAgain")}
              </Button>
            </div>
          </Card>
        </Show>
      </div>
    </Dialog>
  )
}
