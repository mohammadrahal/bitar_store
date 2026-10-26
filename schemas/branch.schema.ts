import { z } from 'zod'

const phoneField = z
  .string()
  .trim()
  .max(24, 'Phone number is too long')
  .refine((value) => value === '' || /^\+?[\d][\d\s()-]{5,22}$/.test(value), 'Use digits, spaces and + ( ) - only')

/** Matches POST /branches on the real API. */
export const branchCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(20, 'Code is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, - and _ only')
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
})

export type BranchCreateFormValues = z.infer<typeof branchCreateSchema>

export const emptyBranchCreateValues: BranchCreateFormValues = {
  code: '',
  name: '',
}

/** Legacy mock fields — unused by the API client. */
export const branchSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name is too long'),
  location: z.string().trim().min(3, 'Location must be at least 3 characters').max(120, 'Location is too long'),
  phone: phoneField,
  isActive: z.boolean(),
})

export type BranchFormValues = z.infer<typeof branchSchema>

export const emptyBranchValues: BranchFormValues = {
  name: '',
  location: '',
  phone: '',
  isActive: true,
}
