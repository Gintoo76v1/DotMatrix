import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Invalid email').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().max(100).optional(),
});
