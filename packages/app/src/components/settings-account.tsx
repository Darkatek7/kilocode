import { type Component, For, Show, createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { Card } from "@opencode-ai/ui/card"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { Select } from "@opencode-ai/ui/select"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { showToast } from "@opencode-ai/ui/toast"
import { DateTime } from "luxon"
import { useLanguage } from "@/context/language"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"
import { DialogDeviceAuth } from "./dialog-device-auth"

type OrgOption = {
  value: string
  label: string
  description?: string
}

type KiloNotification = {
  id: string
  title: string
  message: string
  action?: {
    actionText: string
    actionURL: string
  }
  showIn?: string[]
}

type CloudSession = {
  session_id: string
  title: string | null
  created_at: string
  updated_at: string
  version: number
}

const PERSONAL = "personal"

const formatBalance = (amount: number): string => {
  return `$${amount.toFixed(2)}`
}

const formatRelative = (dateStr: string): string => {
  try {
    return DateTime.fromISO(dateStr).toRelative() ?? dateStr
  } catch {
    return dateStr
  }
}

export const SettingsAccount: Component = () => {
  const globalSDK = useGlobalSDK()
  const platform = usePlatform()
  const language = useLanguage()
  const dialog = useDialog()

  const [profile, { refetch: refetchProfile }] = createResource(async () => {
    try {
      const result = await globalSDK.client.kilo.profile()
      if (result.error) {
        const status = (result.error as { data?: { status?: number } })?.data?.status
        if (status === 401) return null
        throw result.error
      }
      return result.data
    } catch (err) {
      const status = (err as { data?: { status?: number } })?.data?.status
      if (status === 401) return null
      throw err
    }
  })

  const [notifications, { refetch: refetchNotifications }] = createResource(
    async () => {
      try {
        const result = await globalSDK.client.kilo.notifications()
        if (result.error) return [] as KiloNotification[]
        return (result.data ?? []).filter((n: KiloNotification) => {
          if (!n.showIn || n.showIn.length === 0) return true
          return n.showIn.includes("web") || n.showIn.includes("all")
        }) as KiloNotification[]
      } catch {
        return [] as KiloNotification[]
      }
    },
    { initialValue: [] as KiloNotification[] },
  )

  const [cloudStore, setCloudStore] = createStore({
    sessions: [] as CloudSession[],
    nextCursor: null as string | null,
    loading: false,
    loadingMore: false,
    importingId: null as string | null,
  })

  const fetchCloudSessions = async (cursor?: string) => {
    if (cursor === undefined) setCloudStore("loading", true)
    else setCloudStore("loadingMore", true)
    try {
      const result = await globalSDK.client.kilo.cloudSessions({ cursor, limit: 20 })
      if (result.error) return
      const data = result.data
      if (!data) return
      if (cursor) {
        setCloudStore("sessions", (prev) => [...prev, ...(data.cliSessions ?? [])])
      } else {
        setCloudStore("sessions", data.cliSessions ?? [])
      }
      setCloudStore("nextCursor", data.nextCursor ?? null)
    } finally {
      setCloudStore("loading", false)
      setCloudStore("loadingMore", false)
    }
  }

  const importCloudSession = async (sessionId: string) => {
    setCloudStore("importingId", sessionId)
    try {
      const result = await globalSDK.client.kilo.cloud.session.import({ sessionId })
      if (result.error) throw result.error
      showToast({ variant: "success", title: language.t("profile.cloudSessions.imported") })
    } catch {
      showToast({ variant: "error", title: language.t("common.requestFailed") })
    } finally {
      setCloudStore("importingId", null)
    }
  }

  const loadMoreCloudSessions = () => {
    if (cloudStore.nextCursor) fetchCloudSessions(cloudStore.nextCursor)
  }

  const handleNotificationAction = (notification: KiloNotification) => {
    if (notification.action?.actionURL) {
      platform.openLink(notification.action.actionURL)
    }
  }

  const orgOptions = createMemo<OrgOption[]>(() => {
    const orgs = profile()?.profile.organizations ?? []
    if (orgs.length === 0) return []
    return [
      { value: PERSONAL, label: language.t("profile.personalAccount") },
      ...orgs.map((org) => ({ value: org.id, label: org.name, description: org.role })),
    ]
  })

  const currentOrg = createMemo(() => {
    const id = profile()?.currentOrgId ?? PERSONAL
    return orgOptions().find((o) => o.value === id)
  })

  const switchOrg = async (option: OrgOption | undefined) => {
    if (!option) return
    const current = profile()?.currentOrgId ?? PERSONAL
    if (option.value === current) return
    try {
      await globalSDK.client.kilo.organization.set({
        organizationId: option.value === PERSONAL ? null : option.value,
      })
      await refetchProfile()
    } catch {
      showToast({ variant: "error", title: language.t("common.requestFailed") })
    }
  }

  const handleLogin = () => {
    dialog.show(() => (
      <DialogDeviceAuth
        onSuccess={async () => {
          dialog.close()
          await refetchProfile()
          await refetchNotifications()
        }}
        onCancel={() => dialog.close()}
      />
    ))
  }

  const handleLogout = async () => {
    try {
      await globalSDK.client.auth.remove({ providerID: "kilo" }, { throwOnError: true })
      await refetchProfile()
      await refetchNotifications()
    } catch {
      showToast({ variant: "error", title: language.t("common.requestFailed") })
    }
  }

  const handleRefresh = async () => {
    await Promise.all([refetchProfile(), refetchNotifications()])
    await fetchCloudSessions()
  }

  const handleDashboard = () => {
    platform.openLink("https://app.kilo.ai/profile")
  }

  return (
    <div class="flex flex-col gap-6">
      <Show
        when={!profile.loading}
        fallback={
          <div class="flex items-center justify-center p-8">
            <Spinner />
          </div>
        }
      >
        <Show
          when={profile.error}
          fallback={
            <Show
              when={profile()}
              fallback={
                <div class="flex flex-col gap-4">
                  <p class="text-14-regular text-text-base">{language.t("profile.notLoggedIn")}</p>
                  <Button variant="primary" onClick={handleLogin}>
                    {language.t("profile.action.login")}
                  </Button>
                </div>
              }
            >
              {(data) => (
                <div class="flex flex-col gap-4">
                  <Card>
                    <div class="flex flex-col gap-3">
                      <p class="text-11-uppercase tracking-wide text-text-base">
                        {language.t("profile.account.label")}
                      </p>
                      <div class="flex flex-col gap-1">
                        <p class="text-14-medium text-text-strong">{data().profile.name || data().profile.email}</p>
                        <p class="text-12-regular text-text-base">{data().profile.email}</p>
                      </div>
                    </div>
                  </Card>

                  <Show when={orgOptions().length > 0}>
                    <Card>
                      <div class="flex flex-col gap-3">
                        <p class="text-11-uppercase tracking-wide text-text-base">{language.t("profile.org.label")}</p>
                        <Select
                          options={orgOptions()}
                          current={currentOrg()}
                          value={(o) => o.value}
                          label={(o) => o.label}
                          onSelect={switchOrg}
                          variant="secondary"
                          size="small"
                          triggerVariant="settings"
                        />
                      </div>
                    </Card>
                  </Show>

                  <Show when={data().balance}>
                    {(balance) => (
                      <Card class="flex items-center justify-between">
                        <div class="flex flex-col gap-1">
                          <p class="text-11-uppercase tracking-wide text-text-base">
                            {language.t("profile.balance.title")}
                          </p>
                          <p class="text-18-semibold text-text-strong">{formatBalance(balance().balance)}</p>
                        </div>
                        <Tooltip value={language.t("profile.balance.refresh")} placement="left">
                          <Button variant="ghost" size="small" onClick={handleRefresh}>
                            ↻ {language.t("common.refresh")}
                          </Button>
                        </Tooltip>
                      </Card>
                    )}
                  </Show>

                  <Show when={notifications().length > 0}>
                    <Card>
                      <div class="flex flex-col gap-3">
                        <p class="text-11-uppercase tracking-wide text-text-base">
                          {language.t("profile.notifications.title")}
                        </p>
                        <div class="flex flex-col gap-2">
                          <For each={notifications().slice(0, 5)}>
                            {(notification) => (
                              <div class="flex items-start gap-3 p-2 rounded bg-bg-subtle hover:bg-bg-base transition-colors">
                                <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                                  <p class="text-13-medium text-text-strong truncate">{notification.title}</p>
                                  <p class="text-12-regular text-text-base line-clamp-2">{notification.message}</p>
                                </div>
                                <Show when={notification.action}>
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={() => handleNotificationAction(notification)}
                                  >
                                    {notification.action!.actionText}
                                  </Button>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Card>
                  </Show>

                  <Card>
                    <div class="flex flex-col gap-3">
                      <div class="flex items-center justify-between">
                        <p class="text-11-uppercase tracking-wide text-text-base">
                          {language.t("profile.cloudSessions.title")}
                        </p>
                        <Show when={!cloudStore.loading && cloudStore.sessions.length > 0}>
                          <Button variant="ghost" size="small" onClick={fetchCloudSessions.bind(null, undefined)}>
                            ↻
                          </Button>
                        </Show>
                      </div>
                      <Show
                        when={!cloudStore.loading}
                        fallback={
                          <div class="flex items-center justify-center p-4">
                            <Spinner />
                          </div>
                        }
                      >
                        <Show
                          when={cloudStore.sessions.length > 0}
                          fallback={
                            <div class="flex flex-col gap-3 items-center py-4">
                              <Icon name="cloud-upload" class="text-text-weak" />
                              <p class="text-13-regular text-text-weak">{language.t("profile.cloudSessions.empty")}</p>
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={fetchCloudSessions.bind(null, undefined)}
                              >
                                {language.t("profile.cloudSessions.load")}
                              </Button>
                            </div>
                          }
                        >
                          <div class="flex flex-col gap-1">
                            <For each={cloudStore.sessions}>
                              {(session) => (
                                <div class="flex items-center justify-between gap-3 p-2 rounded bg-bg-subtle hover:bg-bg-base transition-colors">
                                  <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <p class="text-13-medium text-text-strong truncate">
                                      {session.title ?? language.t("profile.cloudSessions.untitled")}
                                    </p>
                                    <p class="text-11-regular text-text-base">{formatRelative(session.updated_at)}</p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={importCloudSession.bind(null, session.session_id)}
                                    disabled={cloudStore.importingId !== null}
                                  >
                                    {cloudStore.importingId === session.session_id ? (
                                      <Spinner class="size-3.5" />
                                    ) : (
                                      language.t("profile.cloudSessions.import")
                                    )}
                                  </Button>
                                </div>
                              )}
                            </For>
                          </div>
                          <Show when={cloudStore.nextCursor}>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={loadMoreCloudSessions}
                              disabled={cloudStore.loadingMore}
                            >
                              {cloudStore.loadingMore ? (
                                <Spinner class="size-3.5" />
                              ) : (
                                language.t("profile.cloudSessions.loadMore")
                              )}
                            </Button>
                          </Show>
                        </Show>
                      </Show>
                    </div>
                  </Card>

                  <Card>
                    <div class="flex flex-col gap-3">
                      <p class="text-11-uppercase tracking-wide text-text-base">{language.t("profile.links.title")}</p>
                      <div class="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => platform.openLink("https://app.kilo.ai/usage")}
                        >
                          <Icon name="square-arrow-top-right" />
                          {language.t("profile.links.usage")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => platform.openLink("https://app.kilo.ai/billing")}
                        >
                          <Icon name="square-arrow-top-right" />
                          {language.t("profile.links.billing")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => platform.openLink("https://app.kilo.ai/api-keys")}
                        >
                          <Icon name="square-arrow-top-right" />
                          {language.t("profile.links.apiKeys")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => platform.openLink("https://app.kilo.ai/team")}
                        >
                          <Icon name="square-arrow-top-right" />
                          {language.t("profile.links.team")}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <div class="flex gap-3">
                    <Button variant="secondary" onClick={handleDashboard} style={{ flex: "1" }}>
                      {language.t("profile.action.dashboard")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      style={{ flex: "1", color: "var(--icon-critical-base)" }}
                    >
                      {language.t("profile.action.logout")}
                    </Button>
                  </div>
                </div>
              )}
            </Show>
          }
        >
          <Card variant="error">
            <div class="flex flex-col gap-2">
              <p class="text-14-medium text-text-strong">{language.t("profile.error.title")}</p>
              <p class="text-13-regular text-text-base">{language.t("profile.error.description")}</p>
              <Button variant="secondary" size="small" onClick={handleRefresh}>
                {language.t("profile.error.retry")}
              </Button>
            </div>
          </Card>
        </Show>
      </Show>
    </div>
  )
}
