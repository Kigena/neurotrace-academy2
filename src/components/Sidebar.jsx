import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";

const navLinkClasses = ({ isActive }) =>
  [
    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
    isActive
      ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-semibold"
      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent",
  ].join(" ");

function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const [pendingCasesCount, setPendingCasesCount] = useState(0);

  // Fetch pending cases count for admin users
  useEffect(() => {
    if (user?.role === 'admin') {
      const fetchPendingCount = async () => {
        try {
          const data = await apiService.get('/cases/moderation/pending-count');
          setPendingCasesCount(data.count || 0);
        } catch (error) {
          console.error('Failed to fetch pending cases count:', error);
          setPendingCasesCount(0);
        }
      };

      fetchPendingCount();

      // Refresh count every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } w-64 overflow-y-auto flex flex-col md:translate-x-0 md:static md:h-auto md:min-h-screen md:shrink-0 md:overflow-visible`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <div>
              <h2 className="text-lg font-bold text-blue-700">NeuroLinea</h2>
              <p className="text-xs text-slate-500">Academy</p>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden text-slate-500 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 md:flex-none">
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Main
            </p>
            <NavLink to="/" className={navLinkClasses} onClick={handleNavClick} end>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </NavLink>
            <NavLink to="/workflow" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Workflow
            </NavLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Learning
            </p>
            <NavLink to="/patterns" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Patterns
            </NavLink>
            <NavLink to="/diffuse-abnormalities" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" />
              </svg>
              Diffuse Abnormalities
            </NavLink>
            <NavLink to="/neuro-syndromes" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Neuroanatomy &amp; Syndromes
            </NavLink>
            <NavLink to="/neurology-essentials" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4c-3 0-5 2-5 4.5 0 1 .3 1.8.8 2.5C6.7 11.6 6 12.7 6 14c0 2.2 1.8 4 4 4h.5v2h3v-2h.5c2.2 0 4-1.8 4-4 0-1.3-.7-2.4-1.8-3 .5-.7.8-1.5.8-2.5C17 6 15 4 12 4z" />
              </svg>
              Neurology Essentials
            </NavLink>
            <NavLink to="/patterns-review" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12h3l2-6 4 12 3-9 2 3h4" />
              </svg>
              Patterns, Sleep &amp; Drugs
            </NavLink>
            <NavLink to="/acns" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              ACNS Guidelines
            </NavLink>
            <NavLink to="/icu-eeg" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16v10H4zM8 20h8M12 16v4M6 11h3l1.5-3 2 6 1.5-3H18" />
              </svg>
              ICU &amp; cEEG
            </NavLink>
            <NavLink to="/neonatal-pediatric" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8a3 3 0 100-6 3 3 0 000 6zM6 21v-2a6 6 0 0112 0v2M9 13l3 3 3-3" />
              </svg>
              Neonatal &amp; Pediatric
            </NavLink>
            <NavLink to="/sleep-staging" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Sleep Staging
            </NavLink>
            <NavLink to="/lab-safety" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
              </svg>
              Lab Safety &amp; OSHA
            </NavLink>
            <NavLink to="/professional-practice" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 006 0L7 7zm10 0l-3 6a3 3 0 006 0l-3-6z" />
              </svg>
              Ethics &amp; HIPAA
            </NavLink>
            <NavLink to="/standards" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Standards
            </NavLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Community
            </p>
            <NavLink to="/cases" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Cases
            </NavLink>
            <NavLink to="/chat" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </NavLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Technical
            </p>
            <NavLink to="/amplifier-controls" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Amplifier &amp; Filters
            </NavLink>
            <NavLink to="/montages-references" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
              Montages &amp; References
            </NavLink>
            <NavLink to="/head-measurement" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3a7 7 0 00-7 7c0 3 1.5 5 3 6v4h8v-4c1.5-1 3-3 3-6a7 7 0 00-7-7zM9 10h.01M15 10h.01" />
              </svg>
              10-20 Measurement Lab
            </NavLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              EMG/NCS
            </p>
            <NavLink to="/emg-ncs" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              NCS/EMG Study Hub
            </NavLink>
            <NavLink to="/ncs-lab" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12h4l2-5 3 10 2-5h7M5 19h14" />
              </svg>
              NCS Practical Lab
            </NavLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Practice
            </p>
            <NavLink to="/study" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              ABRET Study
            </NavLink>
            <NavLink to="/focus-drills" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
              Focus Drills
            </NavLink>
            <NavLink to="/review" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Review Incorrect
            </NavLink>
            <NavLink to="/quiz" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Quiz
            </NavLink>
            <NavLink to="/progress" className={navLinkClasses} onClick={handleNavClick}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Progress
            </NavLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Achievements
            </p>
            <NavLink to="/leaderboard" className={navLinkClasses} onClick={handleNavClick}>
              <span className="text-xl">🏆</span>
              Ranks
            </NavLink>
            <NavLink to="/achievements" className={navLinkClasses} onClick={handleNavClick}>
              <span className="text-xl">🎖️</span>
              Badges
            </NavLink>
          </div>

          {user?.role === 'admin' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
                Admin
              </p>
              <NavLink to="/admin/moderation" className={navLinkClasses} onClick={handleNavClick}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="flex items-center gap-2 flex-1">
                  Moderation
                  {pendingCasesCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
                      {pendingCasesCount > 9 ? '9+' : pendingCasesCount}
                    </span>
                  )}
                </span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Sidebar Footer - User Info */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
