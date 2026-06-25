import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The native better-sqlite3 binding is used only by the spawned MCP server
  // process (not the Next bundle); keep it external so nothing tries to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
