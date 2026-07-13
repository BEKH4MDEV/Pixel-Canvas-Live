import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ToastHost } from '@/components/ui/Toast';
import { GlobalLoading } from '@/components/GlobalLoading';
import { queryClient } from '@/data/query-client'; // 👈 nuevo import

const CanvasPage = lazy(() => import('@/routes/canvas/CanvasPage').then((m) => ({ default: m.CanvasPage })));
const AdminPage = lazy(() => import('@/routes/admin/AdminPage').then((m) => ({ default: m.AdminPage })));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<GlobalLoading show message="Cargando" />}>
            <Routes>
              <Route path="/" element={<Navigate to="/canvas" replace />} />
              <Route path="/canvas" element={<CanvasPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/canvas" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ToastHost />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
