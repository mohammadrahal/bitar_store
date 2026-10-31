import { FadeIn } from '@/components/motion/fade-in'

/**
 * A template re-mounts on every route change, which a layout does not, so each
 * page fades in as it is navigated to.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <FadeIn className="page-transition">{children}</FadeIn>
}
