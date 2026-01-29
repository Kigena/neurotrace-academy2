import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import Home from "./pages/Home.jsx";
import Patterns from "./pages/Patterns.jsx";
import PatternDetail from "./pages/PatternDetail.jsx";
import PatternCompare from "./pages/PatternCompare.jsx";
import Cases from "./pages/Cases.jsx";
import CaseDetail from "./pages/CaseDetail.jsx";
import Workflow from "./pages/Workflow.jsx";
import Standards from "./pages/Standards.jsx";
import Quiz from "./pages/Quiz.jsx";
import QuizSession from "./pages/QuizSession.jsx";
import Progress from "./pages/Progress.jsx";
import Syndromes from "./pages/Syndromes.jsx";
import SyndromeDetail from "./pages/SyndromeDetail.jsx";
import Navbar from "./components/Navbar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {user && <Navbar />}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/workflow" element={
            <ProtectedRoute>
              <Workflow />
            </ProtectedRoute>
          } />
          <Route path="/patterns" element={
            <ProtectedRoute>
              <Patterns />
            </ProtectedRoute>
          } />
          <Route path="/patterns/:id" element={
            <ProtectedRoute>
              <PatternDetail />
            </ProtectedRoute>
          } />
          <Route path="/patterns/compare" element={
            <ProtectedRoute>
              <PatternCompare />
            </ProtectedRoute>
          } />
          <Route path="/cases" element={
            <ProtectedRoute>
              <Cases />
            </ProtectedRoute>
          } />
          <Route path="/cases/:id" element={
            <ProtectedRoute>
              <CaseDetail />
            </ProtectedRoute>
          } />
          <Route path="/standards" element={
            <ProtectedRoute>
              <Standards />
            </ProtectedRoute>
          } />
          <Route path="/quiz" element={
            <ProtectedRoute>
              <Quiz />
            </ProtectedRoute>
          } />
          <Route path="/quiz/session" element={
            <ProtectedRoute>
              <QuizSession />
            </ProtectedRoute>
          } />
          <Route path="/progress" element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          } />
          <Route path="/syndromes" element={
            <ProtectedRoute>
              <Syndromes />
            </ProtectedRoute>
          } />
          <Route path="/syndromes/:id" element={
            <ProtectedRoute>
              <SyndromeDetail />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      {user && (
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          NeuroTrace Academy · EEG Patterns · Cases · ABRET Prep
        </footer>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
