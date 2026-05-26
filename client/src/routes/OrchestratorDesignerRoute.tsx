import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

const OrchestratorDesigner = lazy(
  () => import('~/components/OrchestratorDesigner/OrchestratorDesigner'),
);

export default function OrchestratorDesignerRoute() {
  const { isAuthenticated, user } = useAuthContext();

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center text-sm text-text-secondary">
          Loading designer…
        </div>
      }
    >
      <OrchestratorDesigner />
    </Suspense>
  );
}
