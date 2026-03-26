export type UserRole = 'ADMIN' | 'USER';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}
