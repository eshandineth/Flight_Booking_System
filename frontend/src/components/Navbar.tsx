import { Plane, Ticket, ShieldCheck, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'search' | 'bookings' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
}

export function Navbar({ activeTab, onSelectTab, onOpenAuth }: NavbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onSelectTab('search')}
        >
          <span className="brand-icon">
            <Plane size={20} />
          </span>
          <span className="brand-text">
            SkyBooker
            <small>Flight Reservations</small>
          </span>
        </button>

        <nav className="nav-links" aria-label="Primary">
          <button
            type="button"
            className={`nav-link ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => onSelectTab('search')}
          >
            <Plane size={16} />
            Search Flights
          </button>

          {user && (
            <button
              type="button"
              className={`nav-link ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => onSelectTab('bookings')}
            >
              <Ticket size={16} />
              My Bookings
            </button>
          )}

          {user?.role === 'ADMIN' && (
            <button
              type="button"
              className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => onSelectTab('admin')}
            >
              <ShieldCheck size={16} />
              Admin Dashboard
            </button>
          )}
        </nav>

        <div className="nav-auth">
          {user ? (
            <div className="user-pill">
              <UserCircle2 size={18} />
              <div className="user-pill-info">
                <span className="user-name">{user.name}</span>
                <span
                  className={`role-badge ${
                    user.role === 'ADMIN' ? 'role-admin' : 'role-customer'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={logout}
                title="Sign out"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          ) : (
            <button type="button" className="btn-primary" onClick={onOpenAuth}>
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

