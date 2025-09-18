import LiveTracker from './LiveTracker';
import { useMessengerId } from '@/features/messenger/hooks/useMessengerId';

export default function MessengerHome() {
  const messengerId = useMessengerId();
  if (!messengerId) return <div className="p-4">Please sign in…</div>;

  return (
    <main className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">Messenger</h1>
      <LiveTracker messengerId={messengerId} />
    </main>
  );
}
