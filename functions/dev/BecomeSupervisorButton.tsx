// src/features/dev/BecomeSupervisorButton.tsx
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export default function BecomeSupervisorButton() {
  const run = async () => {
    const fn = httpsCallable(getFunctions(getApp(), "asia-southeast1"), "devSetRole");
    await fn({ role: "supervisor", admin: true }); // or admin:false
    // Force token refresh so rules see the new claims
    await getAuth().currentUser?.getIdToken(true);
    alert("You are now supervisor/admin. Reload the app.");
  };
  return <button onClick={run} className="px-3 py-2 rounded bg-emerald-600 text-white">Make me Supervisor</button>;
}
