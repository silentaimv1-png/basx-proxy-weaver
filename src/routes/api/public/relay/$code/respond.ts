import { createFileRoute } from "@tanstack/react-router";
import { getRelaySession, json } from "@/lib/relay.server";

// The PC-side connector posts the local app's answer here.
export const Route = createFileRoute("/api/public/relay/$code/respond")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "bad json" }, 400);
        }
        const session = await getRelaySession(supabaseAdmin, params.code);
        if (
          !session ||
          session.mode !== "relay" ||
          !payload?.key ||
          payload.key !== session.agent_key
        ) {
          return json({ error: "unauthorized" }, 401);
        }
        if (!payload.request_id) return json({ error: "missing request_id" }, 400);

        await supabaseAdmin.from("relay_responses").insert({
          request_id: payload.request_id,
          status: Number(payload.status) || 502,
          res_headers: payload.headers ?? {},
          body_b64: payload.body_b64 ?? null,
        });
        return json({ ok: true });
      },
    },
  },
});
