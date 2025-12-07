import { AppId } from '@/types';
import { APPS } from '@/lib/apps';

export default function ComingSoonPage({ params }: { params: { appId: string } }) {
  const app = APPS[params.appId as AppId];
  
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="text-6xl mb-4">{app.icon}</div>
        <h1 className="text-3xl font-bold mb-2">{app.name} App</h1>
        <p className="text-foreground/70 text-lg mb-6">{app.description}</p>
        <div className="glass-card inline-block">
          <p className="text-foreground/60">Coming Soon</p>
        </div>
      </div>
    </div>
  );
}

