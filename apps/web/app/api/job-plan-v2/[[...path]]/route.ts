const DEFAULT_JOB_PLAN_V2_BASE_URL = "http://108.136.189.225:8083";

interface RouteProps {
  params: Promise<{ path?: string[] }>;
}

function baseUrl() {
  return (process.env.JOB_PLAN_V2_BASE_URL?.trim() || DEFAULT_JOB_PLAN_V2_BASE_URL).replace(/\/$/u, "");
}

async function proxy(request: Request, props: RouteProps) {
  const { path = [] } = await props.params;
  const url = new URL(request.url);
  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const upstream = `${baseUrl()}/sm/job-plans/v2${suffix}${url.search}`;

  return fetch(upstream, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
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
