import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores and hyphens'
    ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  displayName: z.string().max(100).optional(),
});

export const projectSchema = z.object({
  name: z.string().min(1).max(255),
  contentJson: z.record(z.any()).optional(),
});
