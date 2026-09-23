// Shared helpers for the BASX cloud-relay mode. Server-only.
export type RelaySession = {
  code: string;
  target_url: string;
  mode: string;
  agent_key: string;
};

export async function getRelaySession(
  supabaseAdmin: any,
  code: string,
): Promise<RelaySession | null> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("code, target_url, mode, agent_key")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as RelaySession;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
