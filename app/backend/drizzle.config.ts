import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({
  path: "../infra/.env",
});

export default {
  schema: "../infra/schema.ts",
  out: "./src/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://ops_user:ops_password_dev@localhost:5432/bitcoin_ops",
  },
} satisfies Config;
