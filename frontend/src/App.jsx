import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/context/AuthContext';
import { setNavigator } from '@/lib/navigation';
import { AppRoutes } from '@/routes/AppRoutes';

function RouterBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <AuthProvider>
        <BrowserRouter>
          <RouterBridge />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}