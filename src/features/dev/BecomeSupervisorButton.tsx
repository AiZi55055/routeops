import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export default function BecomeSupervisorButton() {
  const run = async () => {
    const fn = httpsCallable(getFunctions(getApp(), "asia-southeast1"), "devSetRole");
    await fn({ role: "supervisor", admin: true });
    await getAuth().currentUser?.getIdToken(true); // refresh claims
    alert("You're now supervisor/admin. Reload the page.");
  };
  return (
    <button onClick={run} className="px-3 py-2 rounded bg-emerald-600 text-white">
      Make me Supervisor
    </button>
  );
}
