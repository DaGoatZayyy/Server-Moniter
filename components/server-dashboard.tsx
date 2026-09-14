"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tabs = ["Overview", "Processes", "Network", "Logs", "Errors", "Users", "Storage", "System"];
const processNames = ["System", "svchost.exe", "node.exe", "chrome.exe", "MsMpEng.exe"];

export default function ServerDashboard() {
  const [active, setActive] = useState("Overview");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    const wave = Math.sin(tick / 2);
    return {
      cpu: Math.round(32 + wave * 5),
      memory: Math.round(58 + Math.cos(tick / 3) * 2),
      gpu: Math.round(14 + Math.sin(tick / 3) * 4),
      disk: 67,
      down: (118 + Math.sin(tick) * 12).toFixed(1),
      up: (24 + Math.cos(tick / 2) * 4).toFixed(1),
    };
  }, [tick]);

  const chart = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    time: `${index * 5}s`,
    cpu: Math.max(4, Math.round(31 + Math.sin((index + tick) / 2) * 8)),
    memory: Math.round(57 + Math.cos((index + tick) / 3) * 3),
  })), [tick]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">Server<span>Monitor</span></Link>
        <div className="top-actions"><span className="live-pill"><i className="dot" /> Live · 5s</span><Link className="button" href="/auth/logout">Log out</Link></div>
      </header>
      <main className="main">
        <div className="hero">
          <div>
            <Link className="muted" href="/">← All servers</Link>
            <h1 className="title">My Windows Server</h1>
            <div className="status"><i className="dot" /> ONLINE <span className="muted">· 192.168.1.100 · updated just now</span></div>
          </div>
          <Link className="button" href="/servers/new">Manage server</Link>
        </div>

        <div className="dashboard">
          <nav className="sidebar">
            {tabs.map((tab) => <button className={`navitem ${active === tab ? "active" : ""}`} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}
          </nav>
          <section className="panel">
            {active === "Overview" && <>
              <div className="section-heading"><div><h2>System overview</h2><div className="muted">Live telemetry from the monitoring agent.</div></div><span className="agent-status">Agent connected</span></div>
              <div className="stats">
                {[['CPU', `${metrics.cpu}%`, metrics.cpu], ['Memory', `${metrics.memory}%`, metrics.memory], ['GPU', `${metrics.gpu}%`, metrics.gpu], ['Disk', `${metrics.disk}%`, metrics.disk]].map(([name, value, width]) => <div className="stat" key={name as string}><span className="muted">{name}</span><strong>{value}</strong><div className="bar"><i style={{ width: `${width}%` }} /></div></div>)}
              </div>
              <div className="chart-card"><div className="chart-title"><strong>Resource history</strong><span className="muted">Last 90 seconds</span></div><ResponsiveContainer width="100%" height={230}><AreaChart data={chart}><XAxis dataKey="time" hide /><YAxis domain={[0, 100]} hide /><Tooltip contentStyle={{ background: "#0d1118", border: "1px solid #283140", borderRadius: 8 }} /><Area type="monotone" dataKey="cpu" stroke="#6ee7b7" fill="#6ee7b7" fillOpacity={0.08} strokeWidth={2} /><Area type="monotone" dataKey="memory" stroke="#8b9bb4" fill="#8b9bb4" fillOpacity={0.04} /></AreaChart></ResponsiveContainer></div>
              <div className="quick-grid"><div className="notice"><span className="muted">Network ↓</span><strong>{metrics.down} Mbps</strong></div><div className="notice"><span className="muted">Network ↑</span><strong>{metrics.up} Mbps</strong></div><div className="notice"><span className="muted">Uptime</span><strong>14d 3h</strong></div><div className="notice"><span className="muted">Internet</span><strong>Connected</strong></div></div>
              <h2 className="subheading">Top processes</h2><ProcessTable tick={tick} />
            </>}
            {active === "Processes" && <><h2>Processes</h2><div className="muted">Highest CPU and memory consumers.</div><ProcessTable tick={tick} /></>}
            {active === "Network" && <Network metrics={metrics} />}
            {active === "Logs" && <LogList />}
            {active === "Errors" && <ErrorList />}
            {active === "Users" && <SimplePanel title="Users" text="Local users and active sessions reported by the agent will appear here." />}
            {active === "Storage" && <Storage />}
            {active === "System" && <SimplePanel title="System information" text="Windows Server · Kernel 10.0.26200 · WIN-SERVER · x64 · 24 cores · 32 threads" />}
          </section>
        </div>
      </main>
    </div>
  );
}

function ProcessTable({ tick }: { tick: number }) {
  return <table className="table"><thead><tr><th>Process</th><th>CPU</th><th>Memory</th><th>PID</th></tr></thead><tbody>{processNames.map((name, index) => <tr key={name}><td><strong>{name}</strong></td><td>{Math.max(1, (7.2 - index * 1.1 + Math.sin(tick / 2 + index)).toFixed(1))}%</td><td>{["820 MB", "310 MB", "1.2 GB", "840 MB", "420 MB"][index]}</td><td>{[4, 924, 4820, 7216, 1180][index]}</td></tr>)}</tbody></table>;
}
function Network({ metrics }: { metrics: { down: string; up: string } }) { return <><h2>Network</h2><div className="muted">Current interface throughput.</div><div className="network-grid"><div className="network-card"><span className="muted">Download</span><strong>{metrics.down} Mbps</strong><small>Ethernet · active</small></div><div className="network-card"><span className="muted">Upload</span><strong>{metrics.up} Mbps</strong><small>Ethernet · active</small></div></div><div className="notice">Traffic history will be persisted once the monitoring agent is connected to Supabase.</div></>; }
function LogList() { return <><h2>Logs</h2><div className="muted">Recent agent and operating-system events.</div><div className="log-list">{[["21:04:18","INFO","Agent heartbeat received"],["21:03:52","INFO","Network interface updated"],["21:02:11","INFO","Process snapshot collected"],["20:58:42","WARN","Memory usage crossed 60%"],["20:55:07","INFO","Disk health check passed"]].map(([time, level, text]) => <div className="log-row" key={time}><code>{time}</code><span className={`log-level ${level.toLowerCase()}`}>{level}</span><span>{text}</span></div>)}</div></>; }
function ErrorList() { return <><h2>Errors</h2><div className="muted">Problems detected by the monitoring agent.</div><div className="error-empty"><strong>No active errors</strong><span>The agent has not reported any unresolved errors.</span></div></>; }
function Storage() { return <><h2>Storage</h2><div className="muted">Disk capacity and health.</div><div className="storage-row"><div><strong>C:</strong><span> System Drive</span></div><strong>67% used</strong></div><div className="bar large"><i style={{ width: "67%" }} /></div></>; }
function SimplePanel({ title, text }: { title: string; text: string }) { return <><h2>{title}</h2><div className="muted">{text}</div><div className="notice">Waiting for detailed telemetry from the enrolled monitoring agent.</div></>; }
