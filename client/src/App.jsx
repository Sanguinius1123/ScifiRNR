import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import GameList from './pages/GameList.jsx';
import GameView from './pages/GameView.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/games" element={
            <ProtectedRoute><GameList /></ProtectedRoute>
          } />
          <Route path="/game/:gameId" element={
            <ProtectedRoute><GameView /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
