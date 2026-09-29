/**
 * @module chart-brush
 * The brush of a cartesian `<tec-chart>` (`tec-chart-brush`): a range selector drawn under the plot
 * as HTML (the kind's `overlay`), with two `role="slider"` handles and a draggable band between
 * them. The selected window is stored on the brush element (`start-index`, `end-index`); the chart
 * re-draws the window whenever it changes.
 */
import { html, nothing, type TemplateResult } from "lit"
import { styleMap } from "lit/directives/style-map.js"
import { horizontalStep } from "../../internal/direction.js"
import { brushIndexAt, brushPosition, clampWindow, panWindow } from "./chart-cartesian-engine.js"
import type { ChartContext, Rect } from "./chart-kind.js"
import type { TecChartBrush } from "./chart-parts.js"

/** The brush part of a cartesian model. */
export interface BrushModel {
  element: TecChartBrush
  start: number
  end: number
  /** The number of rows (the brush covers all of them). */
  total: number
  /** The category text of every row (the handles' `aria-valuetext`). */
  texts: string[]
  /** The mini preview of the first series, in the brush's own coordinates. */
  preview?: { area: string; line: string; color: string }
}

type Handle = "start" | "end" | "band"

interface Drag {
  handle: Handle
  pointerId: number
  /** The row under the pointer when a band drag started, and the window then. */
  origin: number
  start: number
  end: number
}

const drags = new WeakMap<TecChartBrush, Drag>()

/** The drawn height of a brush (at least 16px). */
export function brushHeight(brush: TecChartBrush): number {
  return Math.max(16, Number.isFinite(brush.height) ? brush.height : 40)
}

/** The pointer's position along the track, from its inline start. */
function trackPosition(event: PointerEvent, track: HTMLElement, rtl: boolean): number {
  const rect = track.getBoundingClientRect()
  return rtl ? rect.right - event.clientX : event.clientX - rect.left
}

/** Renders the brush under the plot of width `plot.w`, aligned with it. */
export function renderBrush(brush: BrushModel, plot: Rect, ctx: ChartContext): TemplateResult | typeof nothing {
  const { element, start, end, total, texts } = brush
  if (total <= 0) return nothing
  const width = plot.w
  const height = brushHeight(element)
  const xs = brushPosition(start, total, width)
  const xe = brushPosition(end, total, width)
  const page = Math.max(1, Math.round(total / 10))

  const onKeyDown = (event: KeyboardEvent, handle: Handle) => {
    let delta = 0
    let to: "min" | "max" | undefined
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
        delta = horizontalStep(event.key, ctx.host)
        break
      case "ArrowUp":
        delta = 1
        break
      case "ArrowDown":
        delta = -1
        break
      case "PageUp":
        delta = page
        break
      case "PageDown":
        delta = -page
        break
      case "Home":
        to = "min"
        break
      case "End":
        to = "max"
        break
      default:
        return
    }
    event.preventDefault()
    // The element holds the live window (a key repeat can outrun the chart's re-render).
    const [start, end] = current()
    let s = start
    let e = end
    if (handle === "start") s = to === "min" ? 0 : to === "max" ? end : Math.min(end, Math.max(0, start + delta))
    else if (handle === "end") e = to === "min" ? start : to === "max" ? total - 1 : Math.max(start, Math.min(total - 1, end + delta))
    else [s, e] = panWindow(start, end, to === "min" ? -total : to === "max" ? total : delta, total)
    element.select(s, e)
  }

  const current = () => clampWindow(element.startIndex, element.endIndex, total)

  const move = (drag: Drag, index: number) => {
    const [s, e] = current()
    if (drag.handle === "start") element.select(Math.min(index, e), e)
    else if (drag.handle === "end") element.select(s, Math.max(index, s))
    else {
      const [s, e] = panWindow(drag.start, drag.end, index - drag.origin, total)
      element.select(s, e)
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const track = event.currentTarget as HTMLElement
    const index = brushIndexAt(trackPosition(event, track, ctx.rtl), total, width)
    const [start, end] = current()
    let handle = (event.target as Element).closest("[data-brush]")?.getAttribute("data-brush") as Handle | undefined
    if (!handle) {
      // A press on the track moves the nearest handle there.
      handle = index <= start ? "start" : index >= end ? "end" : index - start <= end - index ? "start" : "end"
    }
    const drag: Drag = { handle, pointerId: event.pointerId, origin: index, start, end }
    drags.set(element, drag)
    try {
      track.setPointerCapture(event.pointerId)
    } catch {
      // A pointer that is no longer active: the drag still follows moves over the track.
    }
    if (handle !== "band") move(drag, index)
    track.querySelector<HTMLElement>(`[data-brush="${handle}"]`)?.focus({ preventScroll: true })
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    const drag = drags.get(element)
    if (!drag || drag.pointerId !== event.pointerId) return
    const track = event.currentTarget as HTMLElement
    move(drag, brushIndexAt(trackPosition(event, track, ctx.rtl), total, width))
  }

  const onPointerUp = (event: PointerEvent) => {
    const drag = drags.get(element)
    if (!drag || drag.pointerId !== event.pointerId) return
    drags.delete(element)
    const track = event.currentTarget as HTMLElement
    if (track.hasPointerCapture?.(event.pointerId)) track.releasePointerCapture(event.pointerId)
  }

  const dragging = drags.get(element)?.handle
  const slider = (handle: Handle, label: string, now: number, min: number, max: number, text: string, style: Record<string, string>) => html`<div
    class=${handle === "band" ? "brush-band" : "brush-handle"}
    data-brush=${handle}
    role="slider"
    tabindex="0"
    aria-label=${label}
    aria-orientation="horizontal"
    aria-valuemin=${min}
    aria-valuemax=${max}
    aria-valuenow=${now}
    aria-valuetext=${text}
    ?data-dragging=${dragging === handle}
    style=${styleMap(style)}
    @keydown=${(event: KeyboardEvent) => onKeyDown(event, handle)}
  ></div>`

  // The brush takes no space in the layout: it covers the bottom of the plot box, where the model
  // reserved room for it (so the plot box keeps its size when the brush appears).
  const bottom = ctx.margin.bottom
  return html`<div class="brush" style=${styleMap({ height: `${height}px`, marginBlock: `${-(height + bottom)}px ${bottom}px` })}>
    <div
      class="brush-track"
      style=${styleMap({ insetInlineStart: `${plot.x}px`, width: `${width}px` })}
      @pointerdown=${onPointerDown}
      @pointermove=${onPointerMove}
      @pointerup=${onPointerUp}
      @pointercancel=${onPointerUp}
    >
      ${brush.preview
        ? html`<svg class="brush-preview" width=${width} height=${height} viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
            <path d=${brush.preview.area} fill=${brush.preview.color} fill-opacity="0.2" stroke="none"></path>
            <path d=${brush.preview.line} fill="none" stroke=${brush.preview.color} stroke-width="1"></path>
          </svg>`
        : nothing}
      ${slider("start", element.startLabel, start, 0, end, texts[start] ?? "", { insetInlineStart: `${xs}px` })}
      ${slider("band", element.windowLabel, start, 0, total - 1 - (end - start), `${texts[start] ?? ""} – ${texts[end] ?? ""}`, {
        insetInlineStart: `${xs}px`,
        width: `${Math.max(0, xe - xs)}px`,
      })}
      ${slider("end", element.endLabel, end, start, total - 1, texts[end] ?? "", { insetInlineStart: `${xe}px` })}
    </div>
  </div>`
}
