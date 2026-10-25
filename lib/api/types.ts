export type UserRole = 'admin' | 'manager' | 'employee'

export interface ApiUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  deactivatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiBranch {
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface CreateUserInput {
  email: string
  password: string
  fullName: string
  role: UserRole
}

export interface UpdateUserInput {
  email?: string
  password?: string
  fullName?: string
  role?: UserRole
  isActive?: boolean
}

export interface CreateBranchInput {
  code: string
  name: string
}

export interface HealthResponse {
  status: string
}
