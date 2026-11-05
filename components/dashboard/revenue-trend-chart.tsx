'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
 * Revenue by shop day, one bar per day.
 *
 * Bars, not a line: a day's takings are a quantity that starts at zero and is
 * complete in itself, not a reading of something continuous. A curve through
 * these points implies trade at three in the afternoon on a closed Sunday, and
 * an interpolated slope between two days is a shape the business never had. A
 * closed day draws no bar but keeps its slot on the axis, so the gap is visible
 * as a gap rather than being smoothed over.
 *
 * One series, so there is no legend: the panel title says what is plotted and a
 * box with a single swatch would only restate it.
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
          <BarChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} accessibilityLayer>
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
              cursor={{ fill: CHART_GRID, fillOpacity: 0.35 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as TrendPoint
                return (
                  <ChartTooltip
                    title={shortDay(row.day)}
                    rows={[{ id: SERIES_ID, name: 'Revenue', value: formatPrice(row.revenue), colorIndex: 0 }]}
                    footer={`${formatNumber(row.sales)} ${row.sales === 1 ? 'sale' : 'sales'}`}
                  />
                )
              }}
            />
            {/* No fixed barSize: 7 days and 90 days have to fill the same box,
                so recharts sizes the bars from the category band and a 1px gap
                keeps them separate at the dense end. */}
            <Bar
              dataKey={SERIES_ID}
              name="Revenue"
              fill={COLOR}
              radius={[2, 2, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
