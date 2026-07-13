import { useQuery } from '@tanstack/react-query';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { GlobalLoading } from '@/components/GlobalLoading';
import { AppShell } from './AppShell';
import { Login } from './Login';

/** `/admin` — consola privada del creador. Gate por sesión. */
export function AdminPage() {
  const { data: session, isLoading } = useQuery({ queryKey: queryKeys.session, queryFn: api.session });

  if (isLoading) return <GlobalLoading show message="Cargando" />;
  if (!session?.authenticated) return <Login />;
  return <AppShell />;
}
