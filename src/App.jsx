import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatView from './components/ChatView';
import WalletPage from './components/WalletPage';
import LeaderboardPage from './pages/LeaderboardPage';
import FounderDashboard from './pages/FounderDashboard';
import { useAuth } from './context/AuthContext';
import { useWallet } from './context/WalletContext';

import SignupModal from './components/modals/SignupModal';
import LoginModal from './components/modals/LoginModal';
import PasswordModal from './components/modals/PasswordModal';
import BuyCloseModal from './components/modals/BuyCloseModal';
import StakeModal from './components/modals/StakeModal';
import SwapModal from './components/modals/SwapModal';
import ProfileModal from './components/modals/ProfileModal';
import PrivacyModal from './components/modals/PrivacyModal';
import TermsModal from './components/modals/TermsModal';
import FounderLoginModal from './components/modals/FounderLoginModal';

// Route guard for founder-only pages
function FounderRoute({ children }) {
  const { user } = useAuth();
  const { stakeTier } = useWallet();

  if (!user || stakeTier !== 'founder') {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Protected route wrapper for logged-in users
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const { stakeTier } = useWallet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  // Animated accent – rotate hue every 30 seconds (demo; change to 1800000 for 30 min)
  useEffect(() => {
    let hue = 24; // starting orange
    document.documentElement.style.setProperty('--accent-hue', hue);
    const interval = setInterval(() => {
      hue = (hue + 1) % 360;
      document.documentElement.style.setProperty('--accent-hue', hue);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const openModal = (name) => setActiveModal(name);
  const closeModal = () => setActiveModal(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} openModal={openModal} />
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<ChatView openModal={openModal} toast={toast} />} />
            <Route path="/wallet" element={<WalletPage openModal={openModal} toast={toast} />} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route
              path="/dashboard"
              element={
                <FounderRoute>
                  <FounderDashboard toast={toast} />
                </FounderRoute>
              }
            />
            {/* Add more protected routes as needed */}
          </Routes>
        </main>
      </div>

      {activeModal === 'signup' && <SignupModal onClose={closeModal} toast={toast} />}
      {activeModal === 'login' && <LoginModal onClose={closeModal} toast={toast} />}
      {activeModal === 'password' && <PasswordModal onClose={closeModal} toast={toast} />}
      {activeModal === 'buy' && <BuyCloseModal onClose={closeModal} toast={toast} />}
      {activeModal === 'stake' && <StakeModal onClose={closeModal} toast={toast} />}
      {activeModal === 'swap' && <SwapModal onClose={closeModal} toast={toast} />}
      {activeModal === 'profile' && <ProfileModal onClose={closeModal} toast={toast} openModal={openModal} />}
      {activeModal === 'privacy' && <PrivacyModal onClose={closeModal} />}
      {activeModal === 'terms' && <TermsModal onClose={closeModal} />}
      {activeModal === 'founder' && <FounderLoginModal onClose={closeModal} toast={toast} />}

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl text-[var(--text-primary)] px-5 py-2 rounded-3xl text-xs z-[1100]">
          {toastMsg}
        </div>
      )}
    </div>
  );
}