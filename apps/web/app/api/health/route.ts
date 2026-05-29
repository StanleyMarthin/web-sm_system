export async function GET() {
  return Response.json({
    service: "smsystem-web",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
