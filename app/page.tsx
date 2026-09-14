import Link from "next/link";

const servers = [
  { name: "My Windows Server", ip: "192.168.1.100", cpu: 32, ram: 58, gpu: 14, uptime: "14d 3h" },
  { name: "Development Node", ip: "10.0.0.24", cpu: 18, ram: 41, gpu: 0, uptime: "6d 11h" },
];

function ServerCard({ server }: { server: (typeof servers)[number] }) {
  return <Link className="server-card" href="/servers/demo"><div className="server-head"><div><div className="status"><i className="dot" /> ONLINE</div><div className="server-name">{server.name}</div><div className="ip">{server.ip}</div></div><span className="muted arrow">›</span></div><div className="metrics">{[["CPU",server.cpu],["RAM",server.ram],["GPU",server.gpu]].map(([label,value])=><div className="metric" key={label as string}><div className="metric-label">{label}</div><div className="metric-value">{value}%</div><div className="mini-bar"><i style={{width:`${value}%`}} /></div></div>)}</div><div className="uptime">Uptime <strong>{server.uptime}</strong><span>View dashboard →</span></div></Link>;
}

export default function Home() {
  return <div className="shell"><header className="topbar"><Link className="brand" href="/">Server<span>Monitor</span></Link><div className="top-actions"><Link className="button" href="/auth/login">Log in</Link><Link className="button primary" href="/auth/login?screen_hint=signup">Create account</Link></div></header><main className="main"><section className="hero"><div><div className="eyebrow">Infrastructure</div><h1 className="title">Your servers, at a glance.</h1><div className="muted">Monitor CPU, memory, GPU, network activity, logs and system health from one dashboard.</div></div><Link className="button primary" href="/servers/new">+ Add server</Link></section><div className="overview-strip"><div><span className="muted">Servers</span><strong>2</strong></div><div><span className="muted">Online</span><strong className="healthy">2</strong></div><div><span className="muted">Active alerts</span><strong>0</strong></div><div><span className="muted">Agent status</span><strong className="healthy">Connected</strong></div></div><section className="server-grid">{servers.map((server)=><ServerCard key={server.ip} server={server} />)}</section><div className="notice"><strong>Demo telemetry</strong> · Values are simulated until a monitoring agent is enrolled. Server credentials are never stored in the frontend.</div></main></div>;
}
