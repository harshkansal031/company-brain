// Clerk middleware integration for Next.js app router
import { clerkMiddleware } from "@clerk/nextjs/server";

// Apply Clerk's middleware to all routes except Next.js internals
export default clerkMiddleware();

export const config = {
  // Match all routes except static files, Next.js internals, and MCP proxy
  matcher: ["/((?!_next|api/mcp/).*)", "/"],
};
