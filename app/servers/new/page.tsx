"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function NewServerPage() {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [os, setOs] = useState("windows");
  const [interval, setInterval] = useState("5");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/servers/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, host, os, interval: Number(interval) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Enrollment failed");
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setLoading(false);
    }
  }

  const token = result?.enrollment_code;
  const serverId = token?.split(".")[0];
  const secret = token ? token.split(".").slice(1).join(".") : "";
  const heartbeatUrl = `${typeof window !== "undefined" ? window.location.origin : "https://YOUR-DOMAIN"}/api/agent/heartbeat`;
  const command = token
    ? os === "linux"
      ? `SERVER_ID=${serverId} TOKEN=${secret} URL=${heartbeatUrl} INTERVAL=${interval} sudo -E bash install_linux.sh`
      : `python windows_monitor.py --server-id ${serverId} --token ${secret} --url ${heartbeatUrl} --interval ${interval}`
    : "";

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">Server<span>Monitor</span></Link>
        <Link className="button" href="/">Cancel</Link>
      </header>
      <main className="main narrow">
        <div className="eyebrow">Server enrollment</div>
        <h1 className="title">Add a server</h1>
        <p className="muted lead">Install the lightweight monitoring agent on a machine you own or administer. The web app never needs your server password.</p>
        {!result ? (
          <form className="form-card" onSubmit={submit}>
            <label>Server name<input value={name} onChange={e => setName(e.target.value)} placeholder="My Windows Server" required /></label>
            <label>Hostname or IP<input value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" required /></label>
            <div className="form-grid">
              <label>Operating system<select value={os} onChange={e => setOs(e.target.value)}><option value="windows">Windows</option><option value="linux">Linux</option></select></label>
              <label>Collection interval<select value={interval} onChange={e => setInterval(e.target.value)}><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="30">30 seconds</option></select></label>
            </div>
            <div className="notice"><strong>Secure enrollment</strong><br />A unique agent credential is generated after creation and is only displayed once.</div>
            {error && <div className="notice">{error}</div>}
            <button className="button primary full" disabled={loading}>{loading ? "Creating…" : "Create enrollment"}</button>
          </form>
        ) : (
          <section className="form-card">
            <h2>Enrollment created</h2>
            <p className="muted">Save the credential and install command now. The secret will not be shown again by the dashboard.</p>
            <label>Agent command<textarea readOnly value={command} rows={4} /></label>
            <div className="notice"><strong>Server ID</strong><br />{result.server.id}<br /><br /><strong>One-time enrollment code</strong><br /><code>{token}</code></div>
            <Link className="button primary full" href={`/servers/${result.server.id}`}>Open server dashboard</Link>
          </section>
        )}
        <section className="steps">
          <div><b>01</b><span><strong>Create enrollment</strong><small>Generate a server-specific agent identity.</small></span></div>
          <div><b>02</b><span><strong>Install the agent</strong><small>Run the Windows or Linux monitoring agent on your server.</small></span></div>
          <div><b>03</b><span><strong>Watch live telemetry</strong><small>CPU, GPU, memory, processes, network, logs and errors appear in the dashboard.</small></span></div>
        </section>
      </main>
    </div>
  );
}
