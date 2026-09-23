import { createFileRoute } from "@tanstack/react-router";
import { getRelaySession } from "@/lib/relay.server";

function agentScript(origin: string, code: string, key: string, target: string): string {
  return `# BASX Agent — ${code}
# ดับเบิลคลิกไฟล์นี้ (หรือคลิกขวา > Run with PowerShell) บนคอมที่รันโปรแกรมไว้
# ปิดหน้าต่างนี้เมื่อไหร่ ลิงก์คลาวด์จะหยุดทำงาน
$ErrorActionPreference = 'Continue'
$base = '${origin}'
$code = '${code}'
$key = '${key}'
$target = '${target}'
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(60)
Write-Host "BASX Agent กำลังเชื่อม $code -> $target" -ForegroundColor Green
Write-Host "เปิดหน้าต่างนี้ค้างไว้ ลิงก์ถึงจะใช้งานได้" -ForegroundColor Yellow
while ($true) {
  try {
    $poll = Invoke-RestMethod -Uri "$base/api/public/relay/$code/poll?key=$key" -TimeoutSec 30
    if ($poll.request) {
      $r = $poll.request
      try {
        $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($r.method), ($target + $r.path))
        if ($r.body_b64) {
          $bytes = [Convert]::FromBase64String($r.body_b64)
          $req.Content = [System.Net.Http.ByteArrayContent]::new($bytes)
          if ($r.req_headers.'content-type') {
            $req.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($r.req_headers.'content-type')
          }
        }
        if ($r.req_headers.cookie) { $req.Headers.TryAddWithoutValidation('Cookie', $r.req_headers.cookie) | Out-Null }
        $resp = $client.SendAsync($req).Result
        $rbytes = $resp.Content.ReadAsByteArrayAsync().Result
        $rb64 = [Convert]::ToBase64String($rbytes)
        $ct = ''
        try { $ct = $resp.Content.Headers.ContentType.ToString() } catch {}
        $out = @{ key=$key; request_id=$r.id; status=[int]$resp.StatusCode; headers=@{ 'content-type'=$ct }; body_b64=$rb64 } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$base/api/public/relay/$code/respond" -Method Post -Body $out -ContentType 'application/json' | Out-Null
        Write-Host ("{0} {1} -> {2}" -f $r.method, $r.path, [int]$resp.StatusCode)
      } catch {
        $errBody = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("เชื่อมต่อโปรแกรมในเครื่องไม่ได้: " + $_.Exception.Message))
        $out = @{ key=$key; request_id=$r.id; status=502; headers=@{ 'content-type'='text/plain; charset=utf-8' }; body_b64=$errBody } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$base/api/public/relay/$code/respond" -Method Post -Body $out -ContentType 'application/json' | Out-Null
      }
    } else {
      Start-Sleep -Milliseconds 800
    }
  } catch {
    Start-Sleep -Seconds 3
  }
}
`;
}

// Downloads a ready-to-run PowerShell connector for this cloud session.
export const Route = createFileRoute("/api/public/agent/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const key = new URL(request.url).searchParams.get("key") ?? "";
        const session = await getRelaySession(supabaseAdmin, params.code);
        if (!session || session.mode !== "relay" || !key || key !== session.agent_key) {
          return new Response("unauthorized", { status: 401 });
        }
        const origin = new URL(request.url).origin;
        const script = agentScript(origin, session.code, key, session.target_url);
        return new Response(script, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "content-disposition": `attachment; filename="basx-agent-${session.code}.ps1"`,
          },
        });
      },
    },
  },
});
