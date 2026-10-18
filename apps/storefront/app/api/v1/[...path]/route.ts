import { type NextRequest, NextResponse } from "next/server";
async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (
    path[0] !== "storefront" &&
    !(path[0] === "media" && path.length === 2 && req.method === "GET")
  )
    return NextResponse.json(
      { error: { message: "Not found." } },
      { status: 404 },
    );
  const url = new URL(req.url);
  const base = process.env.STOREFRONT_API_URL ?? "http://127.0.0.1:4001";
  try {
    const upstream = await fetch(
      `${base}/api/v1/${path.map(encodeURIComponent).join("/")}${url.search}`,
      {
        method: req.method,
        headers: {
          "Content-Type": req.headers.get("content-type") ?? "application/json",
          ...Object.fromEntries(
            [
              "cookie",
              "authorization",
              "x-csrf-token",
              "origin",
              "x-photo-consent",
            ].flatMap((name) =>
              req.headers.get(name) ? [[name, req.headers.get(name)!]] : [],
            ),
          ),
          ...(req.headers.get("idempotency-key")
            ? { "Idempotency-Key": req.headers.get("idempotency-key")! }
            : {}),
        },
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: await req.arrayBuffer() }
          : {}),
        cache: "no-store",
      },
    );
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
    for (const cookie of upstream.headers.getSetCookie())
      response.headers.append("Set-Cookie", cookie);
    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "The boutique is temporarily unavailable. Please try again.",
        },
      },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
