import { z } from 'zod'
import { fullNameField, passwordField } from '@/schemas/user.schema'

/** The only part of an account its own owner may change. */
export const profileSchema = z.object({ fullName: fullNameField })

export type ProfileValues = z.infer<typeof profileSchema>

/** Typed twice, because a mistyped new password locks the account out. */
export const passwordChangeSchema = z
  .object({ password: passwordField, confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    message: 'Both passwords must match',
    path: ['confirm'],
  })

export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>

export const emptyPasswordChange: PasswordChangeValues = { password: '', confirm: '' }
