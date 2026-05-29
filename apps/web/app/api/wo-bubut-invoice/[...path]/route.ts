import { cookies } from "next/headers";
import { getApiBaseUrl } from "@/shared/api/config";

interface RouteProps {
  params: Promise<{ path: string[] }>;
}

async function proxy(request: Request, props: RouteProps) {
  const { path } = await props.params;
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const upstream = `${getApiBaseUrl()}/api/wo-bubut-invoice/${path.join("/")}${url.search}`;

  return fetch(upstream, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  });
}

export async function GET(request: Request, props: RouteProps) {
  return proxy(request, props);
}
