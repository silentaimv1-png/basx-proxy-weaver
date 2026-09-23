import { createFileRoute } from "@tanstack/react-router";
import { getRelaySession, json } from "@/lib/relay.server";

// The PC-side connector calls this in a loop to pick up the next waiting request.
export const Route = createFileRoute("/api/public/relay/$code/poll")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const key = new URL(request.url).searchParams.get("key") ?? "";
        const session = await getRelaySession(supabaseAdmin, params.code);
        if (!session || session.mode !== "relay" || !key || key !== session.agent_key) {
          return json({ error: "unauthorized" }, 401);
        }

        const { data } = await supabaseAdmin
          .from("relay_requests")
          .select("id, method, path, req_headers, body_b64")
          .eq("session_code", session.code)
          .order("created_at", { ascending: true })
          .limit(1);

        const req = data?.[0];
        if (!req) return json({ request: null });

        // Claim it: remove from queue so no other poller picks it up.
        await supabaseAdmin.from("relay_requests").delete().eq("id", req.id);
        return json({ request: req });
      },
    },
  },
});
