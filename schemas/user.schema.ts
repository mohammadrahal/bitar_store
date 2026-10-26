import { z } from 'zod'
import type { UserRole } from '@/lib/api/types'

const roleField = z.enum(['admin', 'manager', 'employee'])

const MAX_PASSWORD_BYTES = 72

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).length
}

export const emailField = z.string().trim().toLowerCase().email('Enter a valid email').max(254, 'Email is too long')

const fullNameField = z
  .string()
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name is too long')

export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => utf8Bytes(value) <= MAX_PASSWORD_BYTES, 'Password is too long')

const branchIdField = z.string().uuid('Choose a branch').optional().or(z.literal(''))

function requireBranch(values: { role: UserRole; branchId?: string }, ctx: z.RefinementCtx) {
  if (values.role !== 'admin' && !values.branchId) {
    ctx.addIssue({ code: 'custom', message: 'Assign a branch for managers and employees', path: ['branchId'] })
  }
}

export const createUserSchema = z
  .object({
    email: emailField,
    password: passwordField,
    fullName: fullNameField,
    role: roleField,
    branchId: branchIdField,
  })
  .superRefine(requireBranch)

export type CreateUserFormValues = z.infer<typeof createUserSchema>

export const emptyCreateUserValues: CreateUserFormValues = {
  email: '',
  password: '',
  fullName: '',
  role: 'employee',
  branchId: '',
}

export const updateUserSchema = z
  .object({
    email: emailField,
    fullName: fullNameField,
    /* Blank keeps the current password. */
    password: z.union([z.literal(''), passwordField]),
    role: roleField,
    branchId: branchIdField,
    isActive: z.boolean(),
  })
  .superRefine(requireBranch)

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>

export function toUpdateUserFormValues(
  user: { email: string; fullName: string; role: UserRole; isActive: boolean },
  branchId?: string,
): UpdateUserFormValues {
  return {
    email: user.email,
    fullName: user.fullName,
    password: '',
    role: user.role,
    branchId: branchId ?? '',
    isActive: user.isActive,
  }
}
