import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Container } from '@suraksha/ui';
import { getCurrentUser } from '@/lib/current-user';
import { SidebarNav } from '@/components/my/sidebar-nav';

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Shell for the signed-in /my/* experience. Auth-gated at the layout level:
 * any /my/* route redirects anonymous users to /sign-in with the intended
 * destination preserved as `next`. Keeps individual page components focused
 * on their section content, not auth plumbing.
 */
export default async function MyLayout({ children, params }: Props) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/sign-in?next=/${locale}/my`);
  }

  return (
    <section className="bg-background py-10 sm:py-14">
      <Container className="max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row">
          <SidebarNav locale={locale} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </Container>
    </section>
  );
}
