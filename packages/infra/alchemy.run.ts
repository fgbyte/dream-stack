import alchemy from "alchemy";
import { Vite } from "alchemy/cloudflare";
import { Worker } from "alchemy/cloudflare";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Define paths - Resolve current directory, workspace root, and directories containing environment files
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../..");
const envDirs = [
  path.join(workspaceRoot, "packages/infra"),
  path.join(workspaceRoot, "apps/web"),
  path.join(workspaceRoot, "apps/server"),
];

// Detect runtime mode - Determine if running in local development or deployment based on npm lifecycle events
function getAlchemyMode() {
  const lifecycleEvent = process.env.npm_lifecycle_event;
  const lifecycleScript = process.env.npm_lifecycle_script;

  if (lifecycleEvent === "dev" || lifecycleScript === "alchemy dev") {
    return "local";
  }

  if (lifecycleEvent === "deploy" || lifecycleScript === "alchemy deploy") {
    return "deploy";
  }

  return process.argv.includes("dev") ? "local" : "deploy";
}

// Load environment variables - Load appropriate .env file based on detected mode for each configured directory
function loadEnvForMode(mode: "local" | "deploy") {
  const envFileName = mode === "local" ? ".env.local" : ".env";

  for (const dir of envDirs) {
    const filePath = path.join(dir, envFileName);

    if (!existsSync(filePath)) {
      continue;
    }

    config({
      path: filePath,
      override: true,
    });
  }
}

const mode = getAlchemyMode();
loadEnvForMode(mode);

// Log mode and validate environment - Print detected mode and define utility to validate required environment variables
console.log(`[alchemy] env mode: ${mode}`);
console.log(
  `[alchemy] lifecycle event: ${process.env.npm_lifecycle_event ?? "unknown"}`,
);

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

// Initialize Alchemy application - Create the main Alchemy app instance that will manage all infrastructure resources
const app = await alchemy("dream-stack");

//  Define frontend resource - Configure Vite site with Cloudflare, pointing to the web app with required environment bindings
export const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: requireEnv("VITE_SERVER_URL"),
  },
});

//  Define backend resource - Configure Cloudflare Worker for the API server with secrets, bindings, and development settings
export const server = await Worker("server", {
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    CORS_ORIGIN: requireEnv("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: requireEnv("BETTER_AUTH_URL"),
    DATABASE_AUTH_TOKEN: alchemy.secret.env.DATABASE_AUTH_TOKEN!,
  },
  dev: {
    port: 3000,
  },
});

// Finalize deployment - Print deployed resource URLs and complete the Alchemy lifecycle by applying all changes
console.log(`Web -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
