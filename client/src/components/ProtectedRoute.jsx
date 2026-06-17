import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
