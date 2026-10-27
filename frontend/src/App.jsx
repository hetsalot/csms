import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import Navbar from './components/Navbar';
import StationFinder from './components/DriverPortal/StationFinder';
import StationDetailsModal from './components/DriverPortal/StationDetailsModal';
import BookingModal from './components/DriverPortal/BookingModal';
import ActiveSessionDrawer from './components/DriverPortal/ActiveSessionDrawer';
import BookingsHistory from './components/DriverPortal/BookingsHistory';
import InvoicesModal from './components/DriverPortal/InvoicesModal';
import VehiclesAndPayments from './components/DriverPortal/VehiclesAndPayments';
import OperatorDashboard from './components/OperatorPortal/OperatorDashboard';
import AdminDashboard from './components/AdminPortal/AdminDashboard';
import GuidedWalkthrough from './components/GuidedWalkthrough';
import HelpModal from './components/HelpModal';
import AuthModal from './components/AuthModal';
import { Bell, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

function MainApp() {
  const { user, role, isAuthenticated } = useAuth();
  const { lastEvent, notifications } = useWebSocket();

  // Navigation view
  const [currentView, setCurrentView] = useState('finder'); // finder, bookings, garage, operator, admin

  // Modals state
  const [stationForDetails, setStationForDetails] = useState(null);
  const [stationForBooking, setStationForBooking] = useState(null);
  const [chargerForBooking, setChargerForBooking] = useState(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Live Toast state
  const [toast, setToast] = useState(null);

  // Check if first-time user and launch UD-2 walkthrough
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('csms_has_seen_tour');
    if (!hasSeenTour) {
      setShowWalkthrough(true);
      localStorage.setItem('csms_has_seen_tour', 'true');
    }
  }, []);

  // Update view automatically if role changes
  useEffect(() => {
    if (role === 'admin') {
      setCurrentView('admin');
    } else if (role === 'operator') {
      setCurrentView('operator');
    } else {
      if (currentView === 'admin' || currentView === 'operator') {
        setCurrentView('finder');
      }
    }
  }, [role]);

  // Handle incoming live events for toasts
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'CHARGER_FAULT_ALERT') {
      setToast({
        title: 'Hardware Fault Alert (SF-2)',
        msg: `Charger ${lastEvent.data?.chargerId} reported ${lastEvent.data?.errorCode || 'Fault'}. Isolated from search (SI-1.3).`,
        level: 'danger'
      });
    } else if (lastEvent.type === 'NEW_BOOKING') {
      setToast({
        title: 'New Booking Confirmed (CI-3)',
        msg: `Booking #${lastEvent.data?.bookingNumber} received at ${lastEvent.data?.stationName}.`,
        level: 'success'
      });
    } else if (lastEvent.type === 'CHARGING_STARTED') {
      setToast({
        title: 'Charging Session In Progress',
        msg: `Charger ${lastEvent.data?.chargerId} has initiated power delivery.`,
        level: 'info'
      });
    } else if (lastEvent.type === 'OPERATOR_NOTIFICATION') {
      setToast({
        title: lastEvent.data?.title || 'System Notification',
        msg: lastEvent.data?.message,
        level: 'warning'
      });
    }

    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [lastEvent]);

  // Handle station selection
  const handleSelectStation = (station) => {
    setStationForDetails(station);
  };

  // Handle book charger trigger
  const handleBookCharger = (station, charger) => {
    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }
    setStationForDetails(null);
    setStationForBooking(station);
    setChargerForBooking(charger);
  };

  // Handle re-order booking (Book.Previous.Reorder)
  const handleReorder = async (booking) => {
    try {
      const res = await fetch(`/api/stations/${booking.station_id}`);
      const stn = await res.json();
      const chg = stn.chargers?.find(c => c.id === booking.charger_id) || stn.chargers?.[0];
      setStationForBooking(stn);
      setChargerForBooking(chg);
    } catch (err) {
      alert('Unable to pre-fill reorder. Station may have been modified.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenWalkthrough={() => setShowWalkthrough(true)}
        onOpenHelp={() => setShowHelp(true)}
        onOpenAuth={() => setShowAuth(true)}
        activeSession={activeSession}
        onOpenActiveSession={() => setActiveSession(activeSession || { id: 'BK-1002', booking_number: 1002, station_name: 'VoltCharge SuperHub' })}
      />

      {/* Main View Container */}
      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 20px', flex: 1 }}>
        
        {/* Toast Alert */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1100,
            background: toast.level === 'danger' ? '#ef4444' : toast.level === 'warning' ? '#f59e0b' : '#10b981',
            color: '#ffffff',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
            maxWidth: '380px',
            animation: 'fadeIn 0.3s ease-out',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            {toast.level === 'danger' ? <AlertTriangle size={22} /> : <Zap size={22} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{toast.title}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '2px', lineHeight: 1.3 }}>{toast.msg}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* View Routing */}
        {currentView === 'finder' && (
          <StationFinder
            onSelectStation={handleSelectStation}
            onBookCharger={handleBookCharger}
          />
        )}

        {currentView === 'bookings' && (
          <BookingsHistory
            onOpenInvoice={setActiveInvoiceId}
            onReorderBooking={handleReorder}
            onOpenActiveSession={(bk) => setActiveSession(bk)}
          />
        )}

        {currentView === 'garage' && (
          <VehiclesAndPayments />
        )}

        {currentView === 'operator' && (
          <OperatorDashboard />
        )}

        {currentView === 'admin' && (
          <AdminDashboard />
        )}

      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '24px 20px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.8rem',
        background: 'rgba(11, 15, 25, 0.9)'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>VoltFlow CSMS Release 1.0</strong> • Software Engineering Laboratory Project
          </div>
          <div>
            Authors: <strong>Siddh Sakariya</strong> (2024300200) & <strong>Het Salot</strong> (2024300201) — Comps C3
          </div>
          <div style={{ color: '#10b981' }}>
            ● OCPP 2.0.1 WebSocket Compliant • RESTful Architecture • Relational SQL
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      {stationForDetails && (
        <StationDetailsModal
          station={stationForDetails}
          onClose={() => setStationForDetails(null)}
          onBookCharger={handleBookCharger}
        />
      )}

      {stationForBooking && (
        <BookingModal
          station={stationForBooking}
          initialCharger={chargerForBooking}
          onClose={() => {
            setStationForBooking(null);
            setChargerForBooking(null);
          }}
          onBookingSuccess={(booking) => {
            // Can redirect or set active
          }}
        />
      )}

      {activeSession && (
        <ActiveSessionDrawer
          activeBooking={activeSession}
          onSessionCompleted={() => {
            setActiveSession(null);
            setCurrentView('bookings');
          }}
          onClose={() => setActiveSession(null)}
        />
      )}

      {activeInvoiceId && (
        <InvoicesModal
          invoiceId={activeInvoiceId}
          onClose={() => setActiveInvoiceId(null)}
        />
      )}

      {showWalkthrough && (
        <GuidedWalkthrough onClose={() => setShowWalkthrough(false)} />
      )}

      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <MainApp />
      </WebSocketProvider>
    </AuthProvider>
  );
}
