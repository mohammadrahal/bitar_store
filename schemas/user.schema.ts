import { z } from 'zod'
import type { Role } from '@/types'

const roleField = z.enum(['super_admin', 'manager', 'employee'])

const MAX_PASSWORD_BYTES = 72

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).length
}

export const emailField = z.string().trim().toLowerCase().email('Enter a valid email').max(254, 'Email is too long')

export const fullNameField = z
  .string()
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name is too long')

export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => utf8Bytes(value) <= MAX_PASSWORD_BYTES, 'Password is too long')

const locationsField = z.array(
  z.object({
    locationId: z.string().uuid(),
    access: z.enum(['full', 'view_only']),
  }),
)

/**
 * One shape for create and edit, so the form keeps a single resolver. A new
 * account must set a password; editing leaves the field blank to keep it.
 */
export function userFormSchema(requirePassword: boolean) {
  return z
    .object({
      email: emailField,
      fullName: fullNameField,
      password: requirePassword ? passwordField : z.union([z.literal(''), passwordField]),
      role: roleField,
      locations: locationsField,
    })
    .superRefine((values, ctx) => {
      /* Owners work everywhere; an employee without a location cannot do anything. */
      if (values.role === 'employee' && values.locations.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Assign at least one location', path: ['locations'] })
      }
    })
}

export type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>

export const emptyUserValues: UserFormValues = {
  email: '',
  password: '',
  fullName: '',
  role: 'employee',
  locations: [],
}

export function toUserFormValues(
  user: { email: string; fullName: string; role: Role },
  locations: UserFormValues['locations'],
): UserFormValues {
  return {
    email: user.email,
    fullName: user.fullName,
    password: '',
    role: user.role,
    locations,
  }
}
