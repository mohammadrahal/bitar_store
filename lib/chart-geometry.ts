/**
 * The height a dashboard chart lays out to.
 *
 * It lives here rather than in the chart component because the placeholder
 * shown while recharts loads has to reserve exactly the same height, and must
 * not pull recharts into the first load to find out what it is.
 *
 * The revenue trend plots a fixed window. one bar per day of the chosen period
 *. so its height does not follow the data the way a ranked list's would.
 */
export const REVENUE_TREND_HEIGHT = 260
