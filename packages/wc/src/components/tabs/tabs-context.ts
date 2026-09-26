import { createContext } from "@lit/context"
import type { TecTabsContent } from "./tabs-content.js"
import type { TecTabsTrigger } from "./tabs-trigger.js"

export type TabsOrientation = "horizontal" | "vertical"
export type TabsActivation = "automatic" | "manual"
export type TabsListVariant = "default" | "line"

/** What `tec-tabs` shares with its lists, triggers and panels. A new object on every change. */
export interface TabsContextValue {
  /** The selected value (the first enabled trigger's value when none is set). */
  value: string
  orientation: TabsOrientation
  activation: TabsActivation
  /** User selection (fires the cancelable `tec-value-change`). */
  select(value: string, event?: Event): void
  triggerFor(value: string): TecTabsTrigger | null
  contentFor(value: string): TecTabsContent | null
}

export const tabsContext = createContext<TabsContextValue | undefined>(Symbol("tec-tabs"))

/** What `tec-tabs-list` shares with its triggers. */
export interface TabsListContextValue {
  variant: TabsListVariant
}

export const tabsListContext = createContext<TabsListContextValue | undefined>(Symbol("tec-tabs-list"))
