'use client'

import { roundedRightRect, squareRect } from '@/lib/chart-geometry'
import { CHART_SURFACE, CHART_TEXT, MARK_GAP } from '@/lib/chart-palette'

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: Record<string, unknown>
}

/**
 * One segment of a horizontal bar. Only the row's outermost segment gets the
 * rounded end and the row total beside it, so a series holding zero never
 * rounds mid-bar or leaves a stray label. The 2px stroke in the surface colour
 * is the gap that separates touching segments; no border is drawn around a mark.
 */
export function createSegmentShape(
  seriesId: string,
  outermostOf: (row: Record<string, unknown>) => string,
  totalOf?: (row: Record<string, unknown>) => string,
) {
  return function Segment({ x = 0, y = 0, width = 0, height = 0, fill, payload }: ShapeProps) {
    if (width <= 0 || height <= 0) return null
    const isEnd = payload ? outermostOf(payload) === seriesId : false
    const path = isEnd ? roundedRightRect(x, y, width, height) : squareRect(x, y, width, height)

    return (
      <g>
        <path d={path} fill={fill} stroke={CHART_SURFACE} strokeWidth={MARK_GAP} />
        {isEnd && totalOf && payload && (
          <text
            x={x + width + 8}
            y={y + height / 2}
            fill={CHART_TEXT}
            fontSize={12}
            dominantBaseline="middle"
            textAnchor="start"
          >
            {totalOf(payload)}
          </text>
        )}
      </g>
    )
  }
}
