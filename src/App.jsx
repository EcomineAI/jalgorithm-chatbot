import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import OwnerLogin from './pages/OwnerLogin.jsx'
import OwnerDashboard from './pages/OwnerDashboard.jsx'
import DevDebugPage from './pages/DevDebugPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route
          path="/owner"
          element={
            <ProtectedRoute>
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dev"
          element={
            <ProtectedRoute>
              <DevDebugPage />
            </ProtectedRoute>
          }
        />
        {/* Legacy redirect to Owner Studio */}
        <Route path="/admin/login" element={<Navigate to="/owner/login" replace />} />
        <Route path="/admin" element={<Navigate to="/owner" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
