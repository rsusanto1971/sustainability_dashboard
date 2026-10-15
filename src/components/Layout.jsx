import { NavLink, Outlet } from 'react-router-dom';
import Banner from './Banner.jsx';

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/waste', label: 'Waste' },
  { to: '/utilities', label: 'Utilities' },
  { to: '/targets', label: 'Targets' },
];

export default function Layout() {
  return (
    <>
      <Banner />
      <header className="header">
        <div className="header-inner">
          <span className="brand">Waste and Utilities Dashboard</span>
          <nav className="nav" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        Portfolio project. All figures are sample data generated for this demo. Waste anchors are scaled to public
        figures from a manufacturer&apos;s 2025 sustainability report; site names, streams and utility figures are
        made up.
      </footer>
    </>
  );
}
