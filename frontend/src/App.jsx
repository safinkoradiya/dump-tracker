import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import AllDumps from './pages/AllDumps.jsx';
import DumpDetail from './pages/DumpDetail.jsx';
import AllPolicies from './pages/AllPolicies.jsx';
import PendingPolicies from './pages/PendingPolicies.jsx';
import ResolvedPolicies from './pages/ResolvedPolicies.jsx';
import RMTracking from './pages/RMTracking.jsx';
import BucketOverview from './pages/BucketOverview.jsx';
import RenewalDumps from './pages/RenewalDumps.jsx';
import RenewalDumpDetail from './pages/RenewalDumpDetail.jsx';
import AllRenewals from './pages/AllRenewals.jsx';
import DueSoonRenewals from './pages/DueSoonRenewals.jsx';
import ExpiredRenewals from './pages/ExpiredRenewals.jsx';
import RenewalRMTracking from './pages/RenewalRMTracking.jsx';
import RenewalBucketOverview from './pages/RenewalBucketOverview.jsx';
import RenewalCustomerTracking from './pages/RenewalCustomerTracking.jsx';
import AccessControl from './pages/AccessControl.jsx';
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import {
  canManageUsers,
  canViewDiscrepancyModule,
  canViewDiscrepancyRm,
  canViewPolicies,
  canViewRenewalList,
  canViewRenewalModule,
  canViewRenewalRm,
  clearAuthState,
  getAuthState,
} from './lib/access.js';
import './app.css';

const DISCREPANCY_NAV = [
  { to: '/', label: 'All Dumps', end: true, show: canViewDiscrepancyModule },
  { to: '/policies', label: 'All Policies', show: canViewDiscrepancyModule },
  { to: '/pending', label: 'Pending Policies', show: canViewDiscrepancyModule },
  { to: '/resolved', label: 'Resolved Policies', show: canViewDiscrepancyModule },
  { to: '/buckets', label: 'Bucket Overview', show: canViewDiscrepancyModule },
  { to: '/rm', label: 'RM Tracking', show: canViewDiscrepancyRm },
];

const RENEWAL_NAV = [
  { to: '/renewal-dumps', label: 'Renewal Dumps', show: canViewRenewalModule },
  { to: '/renewals', label: 'All Renewals', end: true, show: canViewRenewalModule },
  { to: '/renewals/due-soon', label: 'Due Soon', show: canViewRenewalModule },
  { to: '/renewals/expired', label: 'Expired', show: canViewRenewalModule },
  { to: '/renewals/buckets', label: 'Renewal Buckets', show: canViewRenewalModule },
  { to: '/renewals/rm', label: 'Renewal RM Tracking', show: canViewRenewalRm },
  { to: '/renewals/customers', label: 'Customer Tracking', show: canViewRenewalModule },
];

function Sidebar() {
  const auth = getAuthState();
  const discrepancyItems = DISCREPANCY_NAV.filter((item) => item.show(auth));
  const renewalItems = RENEWAL_NAV.filter((item) => item.show(auth));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-name">DumpTracker</div>
        <div className="brand-sub">Insurance Ops · v2.0</div>
      </div>

      <nav className="nav">
        {discrepancyItems.length > 0 && (
          <>
            <div className="nav-section">Discrepancies</div>
            {discrepancyItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <span className="nav-dot" />
                {n.label}
              </NavLink>
            ))}
          </>
        )}

        {renewalItems.length > 0 && (
          <>
            <div className="nav-section">Renewals</div>
            {renewalItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <span className="nav-dot" />
                {n.label}
              </NavLink>
            ))}
          </>
        )}

        {canManageUsers(auth) && (
          <>
            <div className="nav-section">Admin</div>
            <NavLink
              to="/access"
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <span className="nav-dot" />
              Users & Access
            </NavLink>
          </>
        )}
      </nav>

      <div style={{ margin: 20, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {auth.username || 'Logged in'}
          {auth.assignedRm ? ` · ${auth.assignedRm}` : ''}
        </div>
        <button
          onClick={() => {
            clearAuthState();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

function NoAccessPage() {
  return (
    <div className="login-page">
      <div className="login-left">
        <h1>Access Required</h1>
        <p>Your account is active, but no app pages are assigned yet.</p>
      </div>
      <div className="login-right">
        <div className="login-card">
          <h2>No Access Yet</h2>
          <p style={{ color: 'var(--text2)', lineHeight: 1.5 }}>
            Ask an admin to assign Discrepancy, Renewal, RM Tracking, or Full Access from the Users &amp; Access page.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<ProtectedRoute allow={canViewDiscrepancyModule}><AllDumps /></ProtectedRoute>} />
          <Route path="/dumps/:id" element={<ProtectedRoute allow={canViewDiscrepancyModule}><DumpDetail /></ProtectedRoute>} />
          <Route path="/policies" element={<ProtectedRoute allow={canViewPolicies}><AllPolicies /></ProtectedRoute>} />
          <Route path="/pending" element={<ProtectedRoute allow={canViewDiscrepancyModule}><PendingPolicies /></ProtectedRoute>} />
          <Route path="/resolved" element={<ProtectedRoute allow={canViewDiscrepancyModule}><ResolvedPolicies /></ProtectedRoute>} />
          <Route path="/buckets" element={<ProtectedRoute allow={canViewDiscrepancyModule}><BucketOverview /></ProtectedRoute>} />
          <Route path="/rm" element={<ProtectedRoute allow={canViewDiscrepancyRm}><RMTracking /></ProtectedRoute>} />

          <Route path="/renewal-dumps" element={<ProtectedRoute allow={canViewRenewalModule}><RenewalDumps /></ProtectedRoute>} />
          <Route path="/renewal-dumps/:id" element={<ProtectedRoute allow={canViewRenewalModule}><RenewalDumpDetail /></ProtectedRoute>} />
          <Route path="/renewals" element={<ProtectedRoute allow={canViewRenewalList}><AllRenewals /></ProtectedRoute>} />
          <Route path="/renewals/due-soon" element={<ProtectedRoute allow={canViewRenewalModule}><DueSoonRenewals /></ProtectedRoute>} />
          <Route path="/renewals/expired" element={<ProtectedRoute allow={canViewRenewalModule}><ExpiredRenewals /></ProtectedRoute>} />
          <Route path="/renewals/buckets" element={<ProtectedRoute allow={canViewRenewalModule}><RenewalBucketOverview /></ProtectedRoute>} />
          <Route path="/renewals/rm" element={<ProtectedRoute allow={canViewRenewalRm}><RenewalRMTracking /></ProtectedRoute>} />
          <Route path="/renewals/customers" element={<ProtectedRoute allow={canViewRenewalModule}><RenewalCustomerTracking /></ProtectedRoute>} />

          <Route path="/access" element={<ProtectedRoute allow={canManageUsers}><AccessControl /></ProtectedRoute>} />
          <Route path="/no-access" element={<ProtectedRoute><NoAccessPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
