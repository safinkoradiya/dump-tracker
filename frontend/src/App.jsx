import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import AllDumps      from './pages/AllDumps.jsx';
import DumpDetail    from './pages/DumpDetail.jsx';
import AllPolicies   from './pages/AllPolicies.jsx';
import PendingPolicies from './pages/PendingPolicies.jsx';
import ResolvedPolicies from './pages/ResolvedPolicies.jsx';
import RMTracking    from './pages/RMTracking.jsx';
import BucketOverview from './pages/BucketOverview.jsx';
import './app.css';

const NAV = [
  { to: '/',           label: 'All Dumps' },
  { to: '/policies',   label: 'All Policies' },
  { to: '/pending',    label: 'Pending Policies' },
  { to: '/resolved',   label: 'Resolved Policies' },
  { to: '/buckets',    label: 'Bucket Overview' },
  { to: '/rm',         label: 'RM Tracking' },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-name">DumpTracker</div>
        <div className="brand-sub">Insurance Ops · v2.0</div>
      </div>
      <nav className="nav">
        <div className="nav-section">Views</div>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <span className="nav-dot" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/"             element={<AllDumps />} />
            <Route path="/dumps/:id"    element={<DumpDetail />} />
            <Route path="/policies"     element={<AllPolicies />} />
            <Route path="/pending"      element={<PendingPolicies />} />
            <Route path="/resolved"     element={<ResolvedPolicies />} />
            <Route path="/buckets"      element={<BucketOverview />} />
            <Route path="/rm"           element={<RMTracking />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}