import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(120, 'Email is too long')
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(72, 'Password is too long'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const emptyLoginValues: LoginFormValues = {
  email: '',
  password: '',
}
