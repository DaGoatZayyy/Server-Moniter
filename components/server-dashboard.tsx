"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tabs = ["Overview", "Processes", "Network", "Logs", "Errors", "Users", "Storage", "System"];
type Telemetry = { server: { id: string; name: string; host: string; status: string; last_seen_at: string | null }; metrics: any[]; processes: any[]; logs: any[]; errors: any[] };

export default function ServerDashboard({ serverId = "" }: { serverId?: string }) {
  const [active, setActive] = useState("Overview");
  const [data, setData] = useState<Telemetry | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    if (!serverId) return;
    try {
      const response = await fetch(`/api/servers/${serverId}/telemetry?limit=30`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to load telemetry");
      setData(json); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load telemetry"); }
  }

  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer); }, [serverId]);

  const latest = data?.metrics?.[0] ?? {};
  const metrics = { cpu: Number(latest.cpu_percent ?? 0), memory: Number(latest.memory_percent ?? 0), gpu: Number(latest.gpu_percent ?? 0), disk: Number(latest.disk_percent ?? 0), down: Number(latest.download_mbps ?? 0), up: Number(latest.upload_mbps ?? 0) };
  const chart = useMemo(() => [...(data?.metrics ?? [])].reverse().map((m, i) => ({ time: i, cpu: Number(m.cpu_percent ?? 0), memory: Number(m.memory_percent ?? 0) })), [data]);
  const server = data?.server;

  return <div className="shell"><header className="topbar"><Link className="brand" href="/">Server<span>Monitor</span></Link><div className="top-actions"><span className="live-pill"><i className="dot" /> Live · 5s</span><Link className="button" href="/auth/logout">Log out</Link></div></header><main className="main">
    <div className="hero"><div><Link className="muted" href="/">← All servers</Link><h1 className="title">{server?.name ?? "Server"}</h1><div className="status"><i className="dot" /> {server?.status?.toUpperCase() ?? "LOADING"} <span className="muted">· {server?.host ?? ""} · {server?.last_seen_at ? new Date(server.last_seen_at).toLocaleTimeString() : "waiting for agent"}</span></div></div><Link className="button" href="/servers/new">Manage server</Link></div>
    {error && <div className="notice">{error}</div>}
    {!serverId && <div className="notice">This dashboard is ready for a real server ID. The demo route must be connected to an enrolled server.</div>}
    <div className="dashboard"><nav className="sidebar">{tabs.map(tab => <button className={`navitem ${active === tab ? "active" : ""}`} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</nav><section className="panel">
      {active === "Overview" && <><div className="section-heading"><div><h2>System overview</h2><div className="muted">Live telemetry from the monitoring agent.</div></div><span className="agent-status">{server?.status === "online" ? "Agent connected" : "Waiting for agent"}</span></div><div className="stats">{[["CPU",metrics.cpu],["Memory",metrics.memory],["GPU",metrics.gpu],["Disk",metrics.disk]].map(([name,width]) => <div className="stat" key={name as string}><span className="muted">{name}</span><strong>{Number(width).toFixed(0)}%</strong><div className="bar"><i style={{width:`${Math.min(100, Math.max(0, Number(width)))}%`}} /></div></div>)}</div><div className="chart-card"><div className="chart-title"><strong>Resource history</strong><span className="muted">Latest samples</span></div><ResponsiveContainer width="100%" height={230}><AreaChart data={chart}><XAxis dataKey="time" hide /><YAxis domain={[0,100]} hide /><Tooltip /><Area type="monotone" dataKey="cpu" stroke="#6ee7b7" fill="#6ee7b7" fillOpacity={0.08} strokeWidth={2}/><Area type="monotone" dataKey="memory" stroke="#8b9bb4" fill="#8b9bb4" fillOpacity={0.04}/></AreaChart></ResponsiveContainer></div><div className="quick-grid"><div className="notice"><span className="muted">Network ↓</span><strong>{metrics.down.toFixed(1)} Mbps</strong></div><div className="notice"><span className="muted">Network ↑</span><strong>{metrics.up.toFixed(1)} Mbps</strong></div><div className="notice"><span className="muted">Uptime</span><strong>{formatUptime(Number(latest.uptime_seconds ?? 0))}</strong></div><div className="notice"><span className="muted">Internet</span><strong>{server?.status === "online" ? "Connected" : "Waiting"}</strong></div></div><h2 className="subheading">Top processes</h2><ProcessTable processes={data?.processes ?? []}/></>}
      {active === "Processes" && <><h2>Processes</h2><div className="muted">Latest CPU and memory consumers reported by the agent.</div><ProcessTable processes={data?.processes ?? []}/></>}
      {active === "Network" && <><h2>Network</h2><div className="muted">Latest interface throughput.</div><div className="network-grid"><div className="network-card"><span className="muted">Download</span><strong>{metrics.down.toFixed(1)} Mbps</strong><small>Latest agent sample</small></div><div className="network-card"><span className="muted">Upload</span><strong>{metrics.up.toFixed(1)} Mbps</strong><small>Latest agent sample</small></div></div></>}
      {active === "Logs" && <LogList logs={data?.logs ?? []}/>} {active === "Errors" && <ErrorList errors={data?.errors ?? []}/>} {active === "Users" && <SimplePanel title="Users" text="Local users and active sessions reported by the agent will appear here."/>} {active === "Storage" && <Storage value={metrics.disk}/>} {active === "System" && <SimplePanel title="System information" text={server ? `${server.name} · ${server.host}` : "Waiting for server telemetry."}/>} 
    </section></div></main></div>;
}

function ProcessTable({ processes }: { processes: any[] }) { const latest = new Map<string, any>(); for (const p of processes) if (!latest.has(p.name)) latest.set(p.name,p); const rows=[...latest.values()].sort((a,b)=>Number(b.cpu_percent)-Number(a.cpu_percent)).slice(0,20); return <table className="table"><thead><tr><th>Process</th><th>CPU</th><th>Memory</th><th>PID</th></tr></thead><tbody>{rows.length ? rows.map(p=><tr key={`${p.name}-${p.pid}`}><td><strong>{p.name}</strong></td><td>{Number(p.cpu_percent??0).toFixed(1)}%</td><td>{Number(p.memory_mb??0).toFixed(0)} MB</td><td>{p.pid}</td></tr>) : <tr><td colSpan={4}>No process telemetry yet.</td></tr>}</tbody></table>; }
function LogList({logs}:{logs:any[]}) { return <><h2>Logs</h2><div className="muted">Recent agent events.</div><div className="log-list">{logs.length ? logs.map(l=><div className="log-row" key={l.id}><code>{new Date(l.created_at).toLocaleTimeString()}</code><span className={`log-level ${l.level}`}>{String(l.level).toUpperCase()}</span><span>{l.message}</span></div>) : <div className="notice">No logs reported.</div>}</div></>; }
function ErrorList({errors}:{errors:any[]}) { const active=errors.filter(e=>!e.resolved_at); return <><h2>Errors</h2><div className="muted">Problems detected by the monitoring agent.</div><div className="error-empty"><strong>{active.length ? `${active.length} active error${active.length===1?"":"s"}` : "No active errors"}</strong><span>{active.length ? active[0].message : "The agent has not reported any unresolved errors."}</span></div></>; }
function Storage({value}:{value:number}) { return <><h2>Storage</h2><div className="muted">Latest disk capacity report.</div><div className="storage-row"><div><strong>C:</strong><span> System Drive</span></div><strong>{value.toFixed(0)}% used</strong></div><div className="bar large"><i style={{width:`${Math.min(100,Math.max(0,value))}%`}}/></div></>; }
function SimplePanel({title,text}:{title:string;text:string}) { return <><h2>{title}</h2><div className="muted">{text}</div><div className="notice">Waiting for detailed telemetry from the enrolled monitoring agent.</div></>; }
function formatUptime(seconds:number) { if (!seconds) return "—"; const d=Math.floor(seconds/86400), h=Math.floor(seconds%86400/3600), m=Math.floor(seconds%3600/60); return `${d}d ${h}h ${m}m`; }
