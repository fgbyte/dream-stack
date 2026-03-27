import { env } from "@dream-stack/env/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema/index.js";

const client = createClient({
  url: env.DATABASE_URL || "",
  authToken: env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle({ client, schema });
