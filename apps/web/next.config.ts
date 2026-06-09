import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Single source of secrets lives at the workspace root .env.local (gitignored),
// not duplicated per-app. Load it before Next reads process.env.
loadEnv({ path: resolve(process.cwd(), "../../.env.local") });

const nextConfig: NextConfig = {};

export default nextConfig;
