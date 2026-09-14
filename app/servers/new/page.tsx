import Link from "next/link";

export default function NewServerPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">Server<span>Monitor</span></Link>
        <Link className="button" href="/">Cancel</Link>
      </header>
      <main className="main narrow">
        <div className="eyebrow">Server enrollment</div>
        <h1 className="title">Add a server</h1>
        <p className="muted lead">Install the lightweight monitoring agent on the machine you want to monitor. The agent sends telemetry to ServerMonitor without exposing your server password to the dashboard.</p>

        <section className="form-card">
          <label>Server name<input placeholder="My Windows Server" /></label>
          <label>Hostname or IP<input placeholder="192.168.1.100" /></label>
          <div className="form-grid">
            <label>Operating system<select defaultValue="windows"><option value="windows">Windows</option><option value="linux">Linux</option></select></label>
            <label>Collection interval<select defaultValue="5"><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="30">30 seconds</option></select></label>
          </div>
          <div className="notice"><strong>Secure enrollment</strong><br />No SSH/Windows credentials are required by the web app. A one-time enrollment code will be used by the monitoring agent.</div>
          <button className="button primary full" type="button">Create enrollment</button>
        </section>

        <section className="steps">
          <div><b>01</b><span><strong>Create enrollment</strong><small>Generate a server-specific agent identity.</small></span></div>
          <div><b>02</b><span><strong>Install the agent</strong><small>Run the agent on the server you own or administer.</small></span></div>
          <div><b>03</b><span><strong>Watch live telemetry</strong><small>CPU, GPU, memory, processes, network, logs and errors appear in the dashboard.</small></span></div>
        </section>
      </main>
    </div>
  );
}
