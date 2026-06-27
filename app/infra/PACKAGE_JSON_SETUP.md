# Package.json Setup for Database

Add these scripts to your `app/backend/package.json`:

## Dependencies to Install

```bash
npm install --save pg drizzle-orm
npm install --save-dev drizzle-kit @types/pg
```

## Scripts to Add

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio",
    "db:check": "node -e \"require('./src/db').checkDatabaseConnection().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })\"",
    "db:down": "cd ../infra && docker-compose down",
    "db:up": "cd ../infra && docker-compose up -d && sleep 2 && npm run db:push"
  }
}
```

## Development Workflow

1. Start the database:
   ```bash
   npm run db:up
   ```

2. When you modify `schema.ts`, generate migrations:
   ```bash
   npm run db:generate
   ```

3. Apply migrations:
   ```bash
   npm run db:migrate
   ```

4. Or use push for development:
   ```bash
   npm run db:push
   ```

5. View database in Drizzle Studio:
   ```bash
   npm run db:studio
   ```

6. Stop the database:
   ```bash
   npm run db:down
   ```
