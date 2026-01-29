import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeSelector from "./ThemeSelector";

const navLinkClasses = ({ isActive }) =>
  [
    "px-3 py-1 rounded-md text-sm font-medium transition-colors",
    isActive
      ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-slate-500 hover:bg-slate-100 p-2 rounded-md"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>

          <NavLink to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-lg font-semibold text-blue-700">
              NeuroTrace
            </span>
            <span className="hidden sm:inline text-xs text-slate-500">
              neurotrace.academy
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-1">
            <NavLink to="/" className={navLinkClasses} end>
              Home
            </NavLink>
            <NavLink to="/workflow" className={navLinkClasses}>
              Workflow
            </NavLink>
            <NavLink to="/patterns" className={navLinkClasses}>
              Patterns
            </NavLink>
            <NavLink to="/syndromes" className={navLinkClasses}>
              Syndromes
            </NavLink>
            <NavLink to="/cases" className={navLinkClasses}>
              Cases
            </NavLink>
            <NavLink to="/standards" className={navLinkClasses}>
              Standards
            </NavLink>
            <NavLink to="/quiz" className={navLinkClasses}>
              Quiz
            </NavLink>
            <NavLink to="/progress" className={navLinkClasses}>
              Progress
            </NavLink>
            <NavLink to="/chat" className={navLinkClasses}>
              Chat
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Selector Button */}
          <button
            onClick={() => setShowThemeSelector(true)}
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Change theme"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>

          <NavLink to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="Go to Dashboard">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-sm font-medium text-slate-700">
              {user?.name}
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-500 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Theme Selector Modal */}
        <ThemeSelector isOpen={showThemeSelector} onClose={() => setShowThemeSelector(false)} />
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-2 shadow-lg">
          <nav className="flex flex-col space-y-1">
            <NavLink to="/" className={navLinkClasses} onClick={() => setIsMenuOpen(false)} end>
              Home
            </NavLink>
            <NavLink to="/workflow" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Workflow
            </NavLink>
            <NavLink to="/patterns" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Patterns
            </NavLink>
            <NavLink to="/syndromes" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Syndromes
            </NavLink>
            <NavLink to="/cases" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Cases
            </NavLink>
            <NavLink to="/standards" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Standards
            </NavLink>
            <NavLink to="/quiz" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Quiz
            </NavLink>
            <NavLink to="/progress" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Progress
            </NavLink>
            <NavLink to="/chat" className={navLinkClasses} onClick={() => setIsMenuOpen(false)}>
              Chat
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
