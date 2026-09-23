import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BASX PORTAL — Cloud Bridge" },
      { name: "description", content: "เชื่อมโปรแกรมบนคอมของคุณเข้ากับเว็บคลาวด์อย่างปลอดภัย" },
    ],
  }),
  component: Index,
});

const IPV4_REGEX =
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function randomHex(bytesLength: number): string {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function randomAgentKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function Index() {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("3001");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{
    code: string;
    target: string;
    fullUrl: string;
    agentUrl: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedIp = params.get("ip") ?? localStorage.getItem("basx_last_ip");
    const savedPort = params.get("port") ?? localStorage.getItem("basx_last_port");
    if (savedIp) setIp(savedIp);
    if (savedPort) setPort(savedPort);

    let cancelled = false;
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("basx");
      pc.onicecandidate = (event) => {
        const candidate = event.candidate?.candidate;
        if (!candidate || cancelled || ip) return;
        const match = candidate.match(
          /((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})/,
        );
        const found = match?.[1];
        if (
          found &&
          (found.startsWith("192.168.") ||
            found.startsWith("10.") ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(found))
        ) {
          setIp(found);
          cancelled = true;
          pc.close();
        }
      };
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => undefined);
      window.setTimeout(() => {
        cancelled = true;
        pc.close();
      }, 3000);
    } catch {
      // WebRTC may be unavailable in some browsers.
    }
  }, [ip]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = ip.trim();
    const isIp = IPV4_REGEX.test(trimmed);
    const looksLikeHost =
      /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?(\/.*)?$/i.test(trimmed);
    if (!isIp && !looksLikeHost) {
      setError("ใส่ IPv4 เช่น 192.168.1.10 หรือชื่อโฮสต์ที่เข้าถึงได้จากเครื่องนี้");
      return;
    }

    const portNumber = Number(port);
    if (isIp && (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535)) {
      setError("พอร์ตต้องเป็นตัวเลข 1–65535");
      return;
    }

    const target = isIp
      ? `http://${trimmed}:${portNumber}`
      : (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).replace(/\/+$/, "");
    const code = `BASX-${randomHex(3)}`;
    const agentKey = randomAgentKey();

    setLoading(true);
    try {
      const { error: insertError } = await supabase.from("sessions").insert({
        code,
        target_url: target,
        password_hash: "",
        mode: "relay",
        agent_key: agentKey,
      });
      if (insertError) throw insertError;

      localStorage.setItem("basx_last_ip", trimmed);
      localStorage.setItem("basx_last_port", String(portNumber));
      const origin = window.location.origin;
      setCreated({
        code,
        target,
        fullUrl: `${origin}/api/public/site/${code}/`,
        agentUrl: `${origin}/api/public/agent/${code}?key=${encodeURIComponent(agentKey)}`,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "สร้างลิงก์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.fullUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="basx-root">
      <div className="basx-grid" />
      <div className="basx-stars" />
      <div className="basx-shooting" />
      <div className="basx-shooting s2" />
      <div className="basx-shooting s3" />
      <div className="basx-shooting s4" />

      <main className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-12" style={{ zIndex: 1 }}>
        <header className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-3">
            <span className="basx-dot basx-pulse" />
            <h1 className="basx-brand-title">BASX PORTAL</h1>
          </div>
          <p className="basx-intro">
            วิธีใช้: กดสร้างลิงก์แล้วใช้เปิดโปรผ่านเว็บได้ทันที<br />
            คำเตือน เปิดเว็บครั้งแรกเซฟลิงก์ไว้ให้ดี ห้ามหาย จะใช้ลิงก์นี้เข้าเว็บไปตลอด
          </p>
        </header>

        {!created ? (
          <form onSubmit={handleSubmit} className="basx-card w-full p-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="basx-label" htmlFor="target">IPv4 หรือ ลิงก์สาธารณะ</label>
                <input
                  id="target"
                  className="basx-input"
                  type="text"
                  placeholder="192.168.1.10 หรือ abc.trycloudflare.com"
                  value={ip}
                  onChange={(event) => setIp(event.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="basx-label" htmlFor="port">Port</label>
                <input
                  id="port"
                  className="basx-input"
                  type="text"
                  inputMode="numeric"
                  value={port}
                  onChange={(event) => setPort(event.target.value)}
                />
              </div>
            </div>

            {error && <p className="basx-error mt-4">{error}</p>}

            <button type="submit" disabled={loading} className="basx-btn mt-5">
              {loading ? "กำลังสร้างลิงก์คลาวด์..." : "สร้างเว็บเปิดโปร"}
            </button>

            <p className="basx-note mt-4 text-center">
              สร้างครั้งเดียว ใช้ลิงก์เดิมได้ตลอด · รหัสไม่ซ้ำกับเครื่องอื่น<br />
              โปรแกรมจะเชื่อมออกไปหาคลาวด์เอง ไม่ต้องเปิดพอร์ตหรือปิดไฟร์วอลล์
            </p>
          </form>
        ) : (
          <section className="basx-card w-full p-6 text-center">
            <p className="basx-success-label">● Cloud session ready</p>
            <div className="mt-4"><span className="basx-code-pill">{created.code}</span></div>
            <p className="basx-note mt-4">
              ขั้นตอนสำคัญ: ดาวน์โหลดตัวเชื่อมไปเปิดบนคอมที่รันโปรแกรมอยู่<br />
              ปล่อยหน้าต่างตัวเชื่อมเปิดค้างไว้ แล้วจึงส่งลิงก์นี้ให้ผู้ใช้อื่น
            </p>

            <div className="basx-link-box mt-5">
              <span className="basx-box-label">ลิงก์สำหรับผู้ใช้งาน</span>
              <input readOnly value={created.fullUrl} onFocus={(event) => event.currentTarget.select()} className="basx-input mt-2" />
              <span className="basx-target">ปลายทางเครื่องนี้: {created.target}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" className="basx-btn ghost" onClick={copyLink}>{copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>
              <a href={created.agentUrl} className="basx-btn" download style={{ textDecoration: "none" }}>ดาวน์โหลดตัวเชื่อม</a>
            </div>
            <a href={created.fullUrl} target="_blank" rel="noopener noreferrer" className="basx-btn ghost mt-3" style={{ textDecoration: "none" }}>เปิดลิงก์ผู้ใช้งาน →</a>
            <button type="button" className="basx-reset mt-4" onClick={() => setCreated(null)}>← สร้างเซสชันใหม่</button>
          </section>
        )}
      </main>
    </div>
  );
}
