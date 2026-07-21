import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatView from './components/ChatView';
import WalletPage from './components/WalletPage';
import LeaderboardPage from './pages/LeaderboardPage';
import FounderDashboard from './pages/FounderDashboard';
import DeveloperPage from './pages/DeveloperPage';
import WorkspacePage from './pages/WorkspacePage';
import PortfolioPage from './pages/PortfolioPage';
import ResearchHub from './pages/ResearchHub';
import LearnPage from './pages/LearnPage';
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
import NotificationsModal from './components/modals/NotificationsModal';
import ChangePasswordModal from './components/modals/ChangePasswordModal';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-[var(--glass-border)] border-t-[var(--accent)] rounded-full animate-spin" />
    </div>
  );
}

function FounderRoute({ children }) {
  const { user } = useAuth();
  const { stakeTier, loadingBal } = useWallet();
  if (loadingBal) return <LoadingSpinner />;
  if (!user || stakeTier !== 'founder') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  // Animated accent (CSS handles it, but we keep the hue property)
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-hue', '240');
  }, []);

  const toast = (msg) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2500);
  };

  const openModal = (name) => setActiveModal(name);
  const closeModal = () => setActiveModal(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} openModal={openModal} />
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} openModal={openModal} sidebarOpen={sidebarOpen} />
        <main className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<ChatView openModal={openModal} toast={toast} />} />
              <Route path="/wallet" element={<WalletPage openModal={openModal} toast={toast} />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/developer" element={<DeveloperPage />} />
              <Route path="/workspaces" element={<WorkspacePage toast={toast} />} />
              <Route path="/portfolio" element={<PortfolioPage toast={toast} />} />
              <Route path="/research" element={<ResearchHub toast={toast} />} />
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/dashboard" element={<FounderRoute><FounderDashboard /></FounderRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
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
      {activeModal === 'notifications' && <NotificationsModal onClose={closeModal} />}
      {activeModal === 'changePassword' && <ChangePasswordModal onClose={closeModal} toast={toast} />}

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl text-[var(--text-primary)] px-5 py-2 rounded-3xl text-xs z-[1100] animate-toast-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
}