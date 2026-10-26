import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const emptyLoginValues: LoginFormValues = {
  email: '',
  password: '',
}
