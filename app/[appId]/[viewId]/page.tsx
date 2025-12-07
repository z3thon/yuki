import { AppId } from '@/types';
import { APPS } from '@/lib/apps';
import EmployeesViewComponent from '@/components/EmployeesView';
import TimeTrackingViewComponent from '@/components/TimeTrackingView';
import PunchAlterationsViewComponent from '@/components/PunchAlterationsView';
import PayPeriodsViewComponent from '@/components/PayPeriodsView';
import UserProfile from '@/components/UserProfile';

export default async function ViewPage({ params }: { params: Promise<{ appId: string; viewId: string }> }) {
  const { appId, viewId } = await params;
  const app = APPS[appId as AppId];
  
  // Render different views based on viewId
  switch (viewId) {
    case 'profile':
      return <UserProfile />;
    case 'employees':
      return <EmployeesViewComponent />;
    case 'time-tracking':
      return <TimeTrackingViewComponent />;
    case 'punch-alterations':
      return <PunchAlterationsViewComponent />;
    case 'pay-periods':
      return <PayPeriodsViewComponent />;
    default:
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">View: {viewId}</h1>
          <p className="text-foreground/70">This view is under construction.</p>
        </div>
      );
  }
}

