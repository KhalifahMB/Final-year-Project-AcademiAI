import { Navigate, Route, Routes } from 'react-router-dom';
import { Guard, SuspenseShell } from './guards';
import { publicRoutes } from './publicRoutes';
import { tenantRoutes } from './tenantRoutes';
import { platformRoutes } from './platformRoutes';
import { NotFoundPage } from '@/components/common/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      {publicRoutes.map(({ path, Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <SuspenseShell>
              <Page />
            </SuspenseShell>
          }
        />
      ))}
      {tenantRoutes.map(({ path, Page, roles, redirect }) => {
        if (redirect) {
          return (
            <Route
              key={path}
              path={path}
              element={<Navigate to={redirect} replace />}
            />
          );
        }
        return (
          <Route
            key={path}
            path={path}
            element={
              <Guard roles={roles}>
                <Page />
              </Guard>
            }
          />
        );
      })}
      {platformRoutes.map(({ path, Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <Guard requireSuperuser>
              <Page />
            </Guard>
          }
        />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}