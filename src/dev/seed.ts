import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function seedMock(companyId: string, messengerId: string) {
  // 1) ensure a messenger doc exists
  await addDoc(collection(db, "messengers"), {
    // if you already have a messenger doc for this uid, skip this and create it manually at /messengers/{messengerId}
  });

  const today = new Date().toISOString().slice(0,10);

  // Center: Bangkok (adjust as you like)
  const center = { lat: 13.7563, lng: 100.5018 };

  function jitter(n:number){ return (Math.random()-0.5) * n; }

  const windows = [
    { label: "Gov office", endHour: 15.5 },
    { label: "Bank", endHour: 16 },
    { label: "Mall", endHour: 20 },
  ];

  const jobs = Array.from({ length: 12 }).map((_, i) => {
    const w = windows[i % windows.length];
    const start = new Date(`${today}T09:00:00Z`).toISOString();
    const end = new Date(`${today}T${String(Math.floor(w.endHour)).padStart(2,"0")}:${(w.endHour%1?30:0).toString().padStart(2,"0")}:00Z`).toISOString();
    const location = { lat: center.lat + jitter(0.08), lng: center.lng + jitter(0.08) };
    return {
      companyId,
      title: `${w.label} #${i+1}`,
      address: `Mock address ${i+1}`,
      location,
      dueDate: today,
      status: "pending",                // required by optimizer
      timeWindows: [{ start, end }],    // simple single window
      serviceDurationSec: 300,
      priority: (i%3)+1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  });

  for (const j of jobs) {
    await addDoc(collection(db, "jobs"), j);
  }

  return { created: jobs.length };
}
