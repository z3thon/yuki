import { redirect } from 'next/navigation';

export default async function AppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  // Redirect to first default view
  redirect(`/${appId}/employees`);
}

