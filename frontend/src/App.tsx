import { useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { ActiveTab, Navbar } from './components/Navbar';
import { SeatSelectionModal } from './components/SeatSelectionModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { SearchFlightsPage } from './pages/SearchFlightsPage';
import { Flight } from './types';

function AppShell() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Redirect away from protected tabs if user logs out
  useEffect(() => {
    if (!user && activeTab !== 'search') {
      setActiveTab('search');
    } else if (user && user.role !== 'ADMIN' && activeTab === 'admin') {
      setActiveTab('search');
    }
  }, [user, activeTab]);

  function triggerRefresh() {
    setRefreshTrigger((n) => n + 1);
  }

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="main-container">
        {loading ? (
          <div className="loading-state">Loading session...</div>
        ) : activeTab === 'search' ? (
          <SearchFlightsPage
            onSelectFlight={(flight) => setSelectedFlight(flight)}
            refreshTrigger={refreshTrigger}
          />
        ) : activeTab === 'bookings' && user ? (
          <MyBookingsPage
            refreshTrigger={refreshTrigger}
            onBookingChanged={triggerRefresh}
            onExploreFlights={() => setActiveTab('search')}
          />
        ) : activeTab === 'admin' && user?.role === 'ADMIN' ? (
          <AdminDashboardPage
            refreshTrigger={refreshTrigger}
            onFlightsChanged={triggerRefresh}
          />
        ) : null}
      </main>

      <SeatSelectionModal
        flight={selectedFlight}
        onClose={() => setSelectedFlight(null)}
        onRequireAuth={() => setAuthModalOpen(true)}
        onBooked={() => triggerRefresh()}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;

