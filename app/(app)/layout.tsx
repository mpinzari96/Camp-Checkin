import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/SignOutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          Camp Check-In
          <small>Youth for God 2026</small>
        </Link>
        <div className="topbar-actions">
          {profile?.role === 'admin' && (
            <Link href="/admin" className="topbar-btn">Admin</Link>
          )}
          <SignOutButton />
        </div>
      </header>
      {children}
    </>
  );
}
