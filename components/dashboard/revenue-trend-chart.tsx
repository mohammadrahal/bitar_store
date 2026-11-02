'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/components/dashboard/chart-tooltip'
import { REVENUE_TREND_HEIGHT } from '@/lib/chart-geometry'
import { CHART_GRID, CHART_TEXT, seriesColor } from '@/lib/chart-palette'
import { CURRENCY, formatCurrency, formatNumber, formatPrice } from '@/lib/format'
import type { TrendPoint } from '@/services/dashboard-trend.service'

const SERIES_ID = 'revenue'
const COLOR = seriesColor(SERIES_ID, 0)

/** "2026-11-02" -> "Nov 02", without constructing a Date per tick. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDay(day: string) {
  const [, month, date] = day.split('-')
  return `${MONTHS[Number(month) - 1] ?? month} ${date}`
}

/**
 * Revenue by shop day. One series, so there is no legend: the panel title says
 * what is plotted and a box with a single swatch would only restate it. The
 * reader aims at a date, so the hover layer is a crosshair that snaps to the
 * nearest day rather than a hit target on the 2px line itself.
 */
export function RevenueTrendChart({ points }: { points: TrendPoint[] }) {
  const peak = points.reduce((max, point) => Math.max(max, point.revenue), 0)
  /* Full figures while the axis stays under 10,000, compact once it passes it —
     one style per axis, never mixed. */
  const tick = (value: number) =>
    peak >= 10_000 ? formatCurrency(value, CURRENCY, true) : formatCurrency(value, CURRENCY)

  return (
    <div className="chart-block">
      <div role="img" aria-label={`Revenue by day, ${points.length} days to ${points.at(-1)?.day ?? 'today'}`}>
        <ResponsiveContainer width="100%" height={REVENUE_TREND_HEIGHT}>
          <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} accessibilityLayer>
            {/* Horizontal only: vertical rules on a time axis are ink that carries
                nothing the x labels do not already say. */}
            <CartesianGrid vertical={false} stroke={CHART_GRID} strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={shortDay}
              stroke={CHART_GRID}
              tick={{ fill: CHART_TEXT, fontSize: 12 }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={72}
              tickFormatter={tick}
              stroke={CHART_GRID}
              tick={{ fill: CHART_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: CHART_TEXT, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as TrendPoint
                return (
                  <ChartTooltip
                    title={shortDay(row.day)}
                    rows={[
                      { id: SERIES_ID, name: 'Revenue', value: formatPrice(row.revenue), colorIndex: 0 },
                    ]}
                    footer={`${formatNumber(row.sales)} ${row.sales === 1 ? 'sale' : 'sales'}`}
                  />
                )
              }}
            />
            <Area
              type="monotone"
              dataKey={SERIES_ID}
              stroke={COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={COLOR}
              fillOpacity={0.1}
              activeDot={{ r: 4, fill: COLOR, stroke: 'var(--chart-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
