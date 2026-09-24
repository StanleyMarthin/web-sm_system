import { getApiBaseUrl } from "@/shared/api/config";

interface RouteProps {
  params: Promise<{ path?: string[] }>;
}

function baseUrl() {
  return (process.env.JOB_PLAN_RUNTIME_BASE_URL?.trim() || `${getApiBaseUrl()}/api/job-plan-runtime`).replace(/\/$/u, "");
}

async function proxy(request: Request, props: RouteProps) {
  const { path = [] } = await props.params;
  const url = new URL(request.url);
  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const upstream = `${baseUrl()}${suffix}${url.search}`;

  return fetch(upstream, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  });
}

export async function GET(request: Request, props: RouteProps) {
  return proxy(request, props);
}

export async function POST(request: Request, props: RouteProps) {
  return proxy(request, props);
}

export async function PUT(request: Request, props: RouteProps) {
  return proxy(request, props);
}
