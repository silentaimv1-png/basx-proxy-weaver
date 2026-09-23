import { createFileRoute } from "@tanstack/react-router";
import {
  b64ToBytes,
  bytesToB64,
  getRelaySession,
  sleep,
} from "@/lib/relay.server";

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-real-ip",
]);

function waitingPage(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>BASX</title></head>
<body style="background:#0a0a0a;color:#d4d4d4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center"><h2>รอเครื่องปลายทางตอบกลับ...</h2>
<p style="color:#737373;font-size:13px">ตรวจสอบว่าเปิดไฟล์ตัวเชื่อม (basx-agent) บนคอมที่รันโปรแกรมไว้แล้ว<br>หน้านี้จะโหลดใหม่เองอัตโนมัติ · ${code}</p></div></body></html>`;
}

async function proxy(request: Request, params: { code: string; _splat?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = params.code.toUpperCase();
  const session = await getRelaySession(supabaseAdmin, code);
  if (!session || session.mode !== "relay") {
    return new Response("not a cloud session", { status: 404 });
  }

  const url = new URL(request.url);
  const prefix = `/api/public/site/${params.code}`;
  let path = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : "/" + (params._splat ?? "");
  if (!path) path = "/";
  path += url.search;

  const reqHeaders: Record<string, string> = {};
  for (const name of ["accept", "content-type", "accept-language", "cookie", "authorization"]) {
    const v = request.headers.get(name);
    if (v) reqHeaders[name] = v;
  }

  let body_b64: string | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const buf = new Uint8Array(await request.arrayBuffer());
    if (buf.length > 0) body_b64 = bytesToB64(buf);
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("relay_requests")
    .insert({ session_code: code, method: request.method, path, req_headers, body_b64 })
    .select("id")
    .single();
  if (error || !inserted) {
    return new Response("queue error", { status: 500 });
  }

  // Wait for the PC connector to answer (up to ~25s).
  for (let i = 0; i < 50; i++) {
    await sleep(500);
    const { data: res } = await supabaseAdmin
      .from("relay_responses")
      .select("status, res_headers, body_b64")
      .eq("request_id", inserted.id)
      .maybeSingle();
    if (!res) continue;
    await supabaseAdmin.from("relay_responses").delete().eq("request_id", inserted.id);

    const headers = new Headers();
    const rh = (res.res_headers ?? {}) as Record<string, string>;
    for (const [k, v] of Object.entries(rh)) {
      const name = k.toLowerCase();
      if (HOP_BY_HOP.has(name) || name === "content-encoding" || name === "set-cookie") continue;
      try { headers.set(k, v); } catch { /* skip */ }
    }

    let body: BodyInit | null = null;
    const ct = (headers.get("content-type") ?? "").toLowerCase();
    if (res.body_b64) {
      if (ct.includes("text/html")) {
        // Make relative asset URLs resolve through the cloud prefix.
        let html = new TextDecoder().decode(b64ToBytes(res.body_b64));
        const base = `<base href="${prefix}/">`;
        html = /<head[^>]*>/i.test(html)
          ? html.replace(/<head[^>]*>/i, (m) => m + base)
          : base + html;
        body = html;
      } else {
        body = b64ToBytes(res.body_b64);
      }
    }
    if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");
    return new Response(body, { status: res.status, headers });
  }

  await supabaseAdmin.from("relay_requests").delete().eq("id", inserted.id);
  return new Response(waitingPage(code), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/public/site/$code/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => proxy(request, params as any),
      POST: async ({ request, params }) => proxy(request, params as any),
      PUT: async ({ request, params }) => proxy(request, params as any),
      PATCH: async ({ request, params }) => proxy(request, params as any),
      DELETE: async ({ request, params }) => proxy(request, params as any),
    },
  },
});
