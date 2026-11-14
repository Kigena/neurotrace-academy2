import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { SocketProvider } from "./contexts/SocketContext.jsx";
import { NotificationProvider } from "./contexts/NotificationContext.jsx";
import { SystemNotificationProvider } from "./contexts/SystemNotificationContext.jsx";
import Home from "./pages/Home.jsx";
import Patterns from "./pages/Patterns.jsx";
import PatternDetail from "./pages/PatternDetail.jsx";
import PatternCompare from "./pages/PatternCompare.jsx";
import Cases from "./pages/Cases.jsx";
import CaseDetail from "./pages/CaseDetail.jsx";
import ShareCase from "./pages/cases/ShareCase.jsx";
import EditCase from "./pages/cases/EditCase.jsx";
import Workflow from "./pages/Workflow.jsx";
import AmplifierFilters from "./pages/AmplifierFilters.jsx";
import MontageReferences from "./pages/MontageReferences.jsx";
import DiffuseAbnormalities from "./pages/DiffuseAbnormalities.jsx";
import NeuroSyndromes from "./pages/NeuroSyndromes.jsx";
import NeurologyEssentials from "./pages/NeurologyEssentials.jsx";
import LabSafety from "./pages/LabSafety.jsx";
import SleepStaging from "./pages/SleepStaging.jsx";
import FocusDrills from "./pages/FocusDrills.jsx";
import ProfessionalPractice from "./pages/ProfessionalPractice.jsx";
import PatternsReview from "./pages/PatternsReview.jsx";
import AcnsGuide from "./pages/AcnsGuide.jsx";
import IcuEeg from "./pages/IcuEeg.jsx";
import NeonatalPediatric from "./pages/NeonatalPediatric.jsx";
import NcsLab from "./pages/NcsLab.jsx";
import HeadMeasureLabPage from "./pages/HeadMeasureLabPage.jsx";
import Standards from "./pages/Standards.jsx";
import Quiz from "./pages/Quiz.jsx";
import QuizSession from "./pages/QuizSession.jsx";
import PatternRecognitionQuiz from "./pages/PatternRecognitionQuiz.jsx";
import Progress from "./pages/Progress.jsx";
import SyndromeRedirect from "./pages/SyndromeRedirect.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Chat from "./pages/Chat.jsx";
import AdminModeration from "./pages/AdminModeration.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Achievements from "./pages/Achievements.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import Notifications from "./pages/Notifications.jsx";
import EmgNcsStudy from "./pages/EmgNcsStudy.jsx";
import StudyDashboard from "./pages/StudyDashboard.jsx";
import ReviewIncorrect from "./pages/ReviewIncorrect.jsx";

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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);


  // Show login page without sidebar
  if (!user && location.pathname === '/login') {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {user && <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
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
            <Route path="/cases/:id/edit" element={
              <ProtectedRoute>
                <EditCase />
              </ProtectedRoute>
            } />
            <Route path="/share-case" element={
              <ProtectedRoute>
                <ShareCase />
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
            <Route path="/quiz/pattern-recognition" element={
              <ProtectedRoute>
                <PatternRecognitionQuiz />
              </ProtectedRoute>
            } />
            {/* Legacy route: the former CertificationExam page was a separate,
                broken exam engine. It now opens the canonical full mock exam. */}
            <Route path="/certification-exam" element={
              <Navigate to="/quiz/session?preset=mock-full-130" replace />
            } />
            <Route path="/study" element={
              <ProtectedRoute>
                <StudyDashboard />
              </ProtectedRoute>
            } />
            <Route path="/review" element={
              <ProtectedRoute>
                <ReviewIncorrect />
              </ProtectedRoute>
            } />
            <Route path="/progress" element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            } />
            <Route path="/leaderboard" element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            } />
            <Route path="/achievements" element={
              <ProtectedRoute>
                <Achievements />
              </ProtectedRoute>
            } />
            <Route path="/syndromes" element={<SyndromeRedirect />} />
            <Route path="/syndromes/:id" element={<SyndromeRedirect />} />
            <Route path="/chat" element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            } />
            <Route path="/admin/moderation" element={
              <ProtectedRoute>
                <AdminModeration />
              </ProtectedRoute>
            } />
            <Route path="/profile/:userId" element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } />

            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />

            <Route path="/emg-ncs" element={
              <ProtectedRoute>
                <EmgNcsStudy />
              </ProtectedRoute>
            } />

            <Route path="/ncs-lab" element={
              <ProtectedRoute>
                <NcsLab />
              </ProtectedRoute>
            } />

            <Route path="/head-measurement" element={
              <ProtectedRoute>
                <HeadMeasureLabPage />
              </ProtectedRoute>
            } />

            <Route path="/amplifier-controls" element={
              <ProtectedRoute>
                <AmplifierFilters />
              </ProtectedRoute>
            } />

            <Route path="/montages-references" element={
              <ProtectedRoute>
                <MontageReferences />
              </ProtectedRoute>
            } />

            <Route path="/diffuse-abnormalities" element={
              <ProtectedRoute>
                <DiffuseAbnormalities />
              </ProtectedRoute>
            } />

            <Route path="/neuro-syndromes" element={
              <ProtectedRoute>
                <NeuroSyndromes />
              </ProtectedRoute>
            } />

            <Route path="/neurology-essentials" element={
              <ProtectedRoute>
                <NeurologyEssentials />
              </ProtectedRoute>
            } />

            <Route path="/drill" element={<Navigate to="/focus-drills" replace />} />
            <Route path="/focus-drills" element={
              <ProtectedRoute>
                <FocusDrills />
              </ProtectedRoute>
            } />

            <Route path="/sleep-staging" element={
              <ProtectedRoute>
                <SleepStaging />
              </ProtectedRoute>
            } />

            <Route path="/lab-safety" element={
              <ProtectedRoute>
                <LabSafety />
              </ProtectedRoute>
            } />

            <Route path="/professional-practice" element={
              <ProtectedRoute>
                <ProfessionalPractice />
              </ProtectedRoute>
            } />

            <Route path="/patterns-review" element={
              <ProtectedRoute>
                <PatternsReview />
              </ProtectedRoute>
            } />

            <Route path="/acns" element={
              <ProtectedRoute>
                <AcnsGuide />
              </ProtectedRoute>
            } />

            <Route path="/icu-eeg" element={
              <ProtectedRoute>
                <IcuEeg />
              </ProtectedRoute>
            } />

            <Route path="/neonatal-pediatric" element={
              <ProtectedRoute>
                <NeonatalPediatric />
              </ProtectedRoute>
            } />
          </Routes>
        </main>

        {user && (
          <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
            NeuroLinea · EEG Patterns · Cases · EMG/NCS · ABRET Prep
          </footer>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <SystemNotificationProvider>
              <AppContent />
            </SystemNotificationProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
