import Link from "next/link";

const servers = [
  { name: "My Windows Server", ip: "192.168.1.100", cpu: 32, ram: 58, gpu: 14, uptime: "14d 3h" },
  { name: "Development Node", ip: "10.0.0.24", cpu: 18, ram: 41, gpu: 0, uptime: "6d 11h" },
];

function ServerCard({ server }: { server: (typeof servers)[number] }) {
  return (
    <Link className="server-card" href="/servers/demo">
      <div className="server-head">
        <div>
          <div className="status"><i className="dot" /> ONLINE</div>
          <div className="server-name">{server.name}</div>
          <div className="ip">{server.ip}</div>
        </div>
        <span className="muted">›</span>
      </div>
      <div className="metrics">
        <div className="metric"><div className="metric-label">CPU</div><div className="metric-value">{server.cpu}%</div></div>
        <div className="metric"><div className="metric-label">RAM</div><div className="metric-value">{server.ram}%</div></div>
        <div className="metric"><div className="metric-label">GPU</div><div className="metric-value">{server.gpu}%</div></div>
      </div>
      <div className="uptime">Uptime <strong>{server.uptime}</strong></div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">Server<span>Monitor</span></Link>
        <div className="top-actions">
          <a className="button" href="/auth/login">Log in</a>
          <a className="button primary" href="/auth/login?screen_hint=signup">Create account</a>
        </div>
      </header>
      <main className="main">
        <section className="hero">
          <div>
            <div className="eyebrow">Infrastructure</div>
            <h1 className="title">Server overview</h1>
            <div className="muted">Monitor CPU, memory, GPU, network activity, logs and system health.</div>
          </div>
          <a className="button primary" href="/servers/new">+ Add server</a>
        </section>
        <section className="server-grid">
          {servers.map((server) => <ServerCard key={server.ip} server={server} />)}
        </section>
        <div className="notice">Demo data is shown until a monitoring agent is enrolled. No server credentials are stored in the frontend.</div>
      </main>
    </div>
  );
}
