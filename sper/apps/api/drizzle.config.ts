import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are the source of truth. Run:
 *   pnpm drizzle-kit generate   # emit SQL migration from schema.ts
 *   pnpm drizzle-kit migrate    # apply pending migrations
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
