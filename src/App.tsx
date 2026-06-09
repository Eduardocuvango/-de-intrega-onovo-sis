import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { RegisterPatient } from './pages/RegisterPatient';
import { PatientList } from './pages/PatientList';
import { SettingsPage } from './pages/Settings';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Patient } from './types';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  if (adminOnly && !isAdmin) {
    // If user is not admin but tries to access admin page, send to patient list
    return <Navigate to="/list" />;
  }

  return <AppLayout>{children}</AppLayout>;
};

const EditRouteWrapper = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'patients', id)).then(snap => {
        if (snap.exists()) setPatient({ id: snap.id, ...snap.data() } as Patient);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return <Loader2 className="animate-spin text-blue-600 mx-auto" />;
  if (!patient) return <div>Paciente não encontrado.</div>;

  return <RegisterPatient initialData={patient} isEditing />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute adminOnly>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/register" element={
              <ProtectedRoute>
                <RegisterPatient />
              </ProtectedRoute>
            } />

            <Route path="/list" element={
              <ProtectedRoute>
                <PatientList />
              </ProtectedRoute>
            } />

            <Route path="/edit/:id" element={
              <ProtectedRoute>
                <EditRouteWrapper />
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute adminOnly>
                <SettingsPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
