'use client'

import { Field } from '@/components/shared/field'
import { FilterChips } from '@/components/shared/filter-chips'
import type { ApiSaleChannel, ApiSocialPlatform } from '@/lib/api/types'
import { SALE_CHANNEL_OPTIONS, SOCIAL_PLATFORM_OPTIONS } from '@/lib/sale-channel'

export function SaleChannelFields({
  channel,
  socialPlatform,
  onChannelChange,
  onSocialPlatformChange,
}: {
  channel: ApiSaleChannel
  socialPlatform: ApiSocialPlatform | null
  onChannelChange: (channel: ApiSaleChannel) => void
  onSocialPlatformChange: (platform: ApiSocialPlatform) => void
}) {
  return (
    <div className="sale-channel-fields">
      <Field label="Outlet">
        <FilterChips
          label="Selling outlet"
          options={SALE_CHANNEL_OPTIONS}
          value={channel}
          onChange={onChannelChange}
        />
      </Field>
      {channel === 'social_media' ? (
        <Field label="Platform">
          <FilterChips
            label="Social platform"
            options={SOCIAL_PLATFORM_OPTIONS}
            value={socialPlatform ?? 'whatsapp'}
            onChange={onSocialPlatformChange}
          />
        </Field>
      ) : null}
    </div>
  )
}
