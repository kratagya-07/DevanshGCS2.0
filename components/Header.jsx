import Link from 'next/link';

export default function Header({ activeTab = 'overview' }) {
  return (
    <header>
      <div className="brand">
        <h1>SWARM OPS</h1>
        <span className="sub">GROUND CONTROL</span>
      </div>
      
      <nav className="top-nav">
        <Link href="/" className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}>
          OVERVIEW
        </Link>
        <Link href="/mission" className={`nav-link ${activeTab === 'mission' ? 'active' : ''}`}>
          MISSION
        </Link>
      </nav>

      <div className="status-pill">
        <span className="dot"></span>
        <span>SIMULATED TELEMETRY</span>
      </div>
    </header>
  );
}
