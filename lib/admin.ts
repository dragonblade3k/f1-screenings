import { isPublicOnly } from "./deployment";

export function requireAdmin(req: Request) {
  // The public deployment serves read paths only. Every api/admin route calls
  // this first, by convention, so refusing here is enough to keep the whole
  // mutation surface out of it without a middleware layer.
  if (isPublicOnly()) return new Response("Not found", { status: 404 });

  const token = process.env.ADMIN_TOKEN || "";
  const got = req.headers.get("x-admin-token") || "";
  if (!token || got !== token) {
    return new Response("Unauthorized (missing/invalid x-admin-token)", { status: 401 });
  }
  return null;
}
