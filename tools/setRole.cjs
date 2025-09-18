// tools/setRole.js
// Usage:
//   node tools/setRole.js --uid <uid> --role supervisor
//   node tools/setRole.js --email you@example.com --role admin

const admin = require("firebase-admin");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(/^--/, "")] = args[i + 1];
  }
  return out;
}

(async () => {
  try {
    const { uid, email, role = "supervisor" } = parseArgs();
    if (!uid && !email) {
      console.error("Provide --uid <uid> or --email <email>");
      process.exit(1);
    }

    // Initialize Admin SDK using GOOGLE_APPLICATION_CREDENTIALS
    admin.initializeApp();

    const auth = admin.auth();
    const userRecord = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);

    await auth.setCustomUserClaims(userRecord.uid, { role });
    // (Optional) revoke sessions so claim takes effect immediately
    await auth.revokeRefreshTokens(userRecord.uid);

    console.log(`Set role="${role}" for uid=${userRecord.uid} (${userRecord.email || "no-email"})`);
    console.log("Ask the user to sign out/in, or call getIdToken(true) on the client.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
