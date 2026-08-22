export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN || "";
  const got = req.headers.get("x-admin-token") || "";
  if (!token || got !== token) {
    return new Response("Unauthorized (missing/invalid x-admin-token)", { status: 401 });
  }
  return null;
}
