import { z } from 'zod';

export const AuthSchema = z.object({
  apiKey: z.string().min(40),
  environment: z.enum(['prod', 'staging'])
});

export type AuthConfig = z.infer<typeof AuthSchema>;