import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AppRoutes } from '@/routes/AppRoutes';

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </>
  );
}