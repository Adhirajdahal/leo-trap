import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import AdminDashboard from '@/components/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/lobby');
  return <AdminDashboard adminName={admin.profile.name} />;
}
