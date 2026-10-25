import { z } from 'zod'
import type { UserRole } from '@/lib/api/types'

const roleField = z.enum(['admin', 'manager', 'employee'])

export const createUserSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email').max(254, 'Email is too long'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
    role: roleField,
    branchId: z.string().uuid('Choose a branch').optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.role !== 'admin' && !values.branchId) {
      ctx.addIssue({ code: 'custom', message: 'Assign a branch for managers and employees', path: ['branchId'] })
    }
  })

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
    email: z.string().trim().email('Enter a valid email').max(254, 'Email is too long'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
    password: z
      .string()
      .max(72, 'Password must be at most 72 characters')
      .refine((value) => value === '' || value.length >= 8, 'Password must be at least 8 characters'),
    role: roleField,
    branchId: z.string().uuid('Choose a branch').optional().or(z.literal('')),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.role !== 'admin' && !values.branchId) {
      ctx.addIssue({ code: 'custom', message: 'Assign a branch for managers and employees', path: ['branchId'] })
    }
  })

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>

export function toUpdateUserFormValues(
  user: { email: string; fullName: string; role: UserRole; isActive: boolean; id: string },
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
