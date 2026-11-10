import type { ApiSaleChannel, ApiSocialPlatform } from '@/lib/api/types'

export const SALE_CHANNEL_OPTIONS: { value: ApiSaleChannel; label: string }[] = [
  { value: 'in_store', label: 'In store' },
  { value: 'social_media', label: 'Social media' },
]

export const SOCIAL_PLATFORM_OPTIONS: { value: ApiSocialPlatform; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Other' },
]

const SOCIAL_LABELS: Record<ApiSocialPlatform, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  other: 'Other',
}

export function socialPlatformLabel(platform: ApiSocialPlatform | string | null | undefined): string {
  if (!platform) return 'Social'
  if (platform in SOCIAL_LABELS) return SOCIAL_LABELS[platform as ApiSocialPlatform]
  return platform
}

export function saleChannelLabel(
  channel: ApiSaleChannel | string,
  socialPlatform?: ApiSocialPlatform | string | null,
): string {
  if (channel === 'in_store') return 'In store'
  if (channel === 'social_media') {
    return socialPlatform ? `Social · ${socialPlatformLabel(socialPlatform)}` : 'Social media'
  }
  return channel
}
