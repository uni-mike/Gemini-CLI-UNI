import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { type Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Reusable middleware that enforces users are logged in */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

/** Reusable middleware that enforces user has specific role */
const hasRole = (role: string[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user || !role.includes(ctx.user.role)) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        user: ctx.user,
      },
    });
  });

/** Reusable middleware for tenant context */
const withTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant context required' });
  }
  return next({
    ctx: {
      tenant: ctx.tenant,
    },
  });
});

export const protectedProcedure = publicProcedure.use(isAuthed);
export const adminProcedure = protectedProcedure.use(hasRole(['ADMIN', 'SUPER_ADMIN']));
export const tenantProcedure = protectedProcedure.use(withTenant);

export const createCallerFactory = t.createCallerFactory;