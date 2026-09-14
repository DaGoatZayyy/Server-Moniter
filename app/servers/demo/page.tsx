import Link from "next/link";

const tabs = ["Overview", "Processes", "Network", "Logs", "Errors", "Users", "Storage", "System"];

export default async function ServerDashboard() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">Server<span>Monitor</span></Link>
        <div className="top-actions"><a className="button" href="/auth/logout">Log out</a></div>
      </header>
      <main className="main">
        <div className="hero">
          <div>
            <Link className="muted" href="/">← All servers</Link>
            <h1 className="title">My Windows Server</h1>
            <div className="status"><i className="dot" /> ONLINE <span className="muted">· 192.168.1.100</span></div>
          </div>
          <button className="button">Refresh</button>
        </div>
        <div className="dashboard">
          <nav className="sidebar">
            {tabs.map((tab, index) => <a className={`navitem ${index === 0 ? "active" : ""}`} href={`#${tab.toLowerCase()}`} key={tab}>{tab}</a>)}
          </nav>
          <section className="panel" id="overview">
            <h2>System overview</h2>
            <div className="muted">Live telemetry from the monitoring agent.</div>
            <div className="stats">
              {[['CPU','32%','32'],['Memory','58%','58'],['GPU','14%','14'],['Disk','67%','67']].map(([name,value,width]) => <div className="stat" key={name}><span className="muted">{name}</span><strong>{value}</strong><div className="bar"><i style={{width:`${width}%`}} /></div></div>)}
            </div>
            <div className="notice"><strong>System:</strong> Windows Server · Kernel 10.0.26200 · Hostname WIN-SERVER · Uptime 14d 3h · Internet online</div>
            <h2 style={{marginTop:28}}>Top processes</h2>
            <table className="table"><thead><tr><th>Process</th><th>CPU</th><th>Memory</th><th>PID</th></tr></thead><tbody>{[['System','7.2%','820 MB','4'],['svchost.exe','5.8%','310 MB','924'],['node.exe','4.1%','1.2 GB','4820'],['chrome.exe','3.7%','840 MB','7216']].map(row=><tr key={row[3]}>{row.map(cell=><td key={cell}>{cell}</td>)}</tr>)}</tbody></table>
          </section>
        </div>
      </main>
    </div>
  );
}
