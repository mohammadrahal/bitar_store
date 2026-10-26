export type UserRole = 'admin' | 'manager' | 'employee'

export interface ApiUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  hasPassword: boolean
  deactivatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LoginResponse {
  token: string
  user: ApiUser
}

/** `GET /auth/me`: who the token belongs to and what they may reach. */
export interface MeResponse {
  user: ApiUser
  permissions: string[]
  branchIds: string[]
  canViewCosts: boolean
}

export interface ApiBranch {
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: string
}

/** Passwords never travel here; they are set with `PUT /users/:id/password`. */
export interface CreateUserInput {
  email: string
  fullName: string
  role: UserRole
}

export interface UpdateUserInput {
  email?: string
  fullName?: string
  role?: UserRole
  isActive?: boolean
}

export interface CreateBranchInput {
  code: string
  name: string
}

/** Shape the branch edit screen sends. No endpoint accepts it yet. */
export interface UpdateBranchInput {
  name?: string
  isActive?: boolean
}

export interface HealthResponse {
  status: string
}
