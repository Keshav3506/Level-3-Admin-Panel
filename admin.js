
/********************************
 * FIREBASE INIT
 ********************************/
const firebaseConfig = {
  apiKey: "AIzaSyCS3WLSYGofKC2VLTevTTLB5orMtqhuvmY",
  authDomain: "king-of-diamonds-3f9c8.firebaseapp.com",
  databaseURL: "https://king-of-diamonds-3f9c8-default-rtdb.firebaseio.com",
  projectId: "king-of-diamonds-3f9c8",
  storageBucket: "king-of-diamonds-3f9c8.firebasestorage.app",
  messagingSenderId: "521723545136",
  appId: "1:521723545136:web:1e1ab70279f7d78261cff5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/********************************
 * DOM ELEMENTS
 ********************************/
const timerEl = document.getElementById("timer");
const teamTable = document.getElementById("teamTable");
const xValueEl = document.getElementById("xValue");
const logEl = document.getElementById("log");

/********************************
 * TIMER CONTROL
 ********************************/
let interval = null;

function startTimer() {
  db.ref("Admin/roundState").set("RUNNING");
  if (interval) return;

  db.ref("Admin/timer").set(30);

  interval = setInterval(async () => {
    const snap = await db.ref("Admin/timer").get();
    let t = snap.val();

    if (t <= 0) {
      clearInterval(interval);
      interval = null;
      calculateRound();
    } else {
      db.ref("Admin/timer").set(t - 1);
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(interval);
  interval = null;
  db.ref("Admin/timer").set(30);
}

/********************************
 * ROUND CALCULATION
 ********************************/
async function calculateRound() {
  const teamsSnap = await db.ref("teams").get();
  if (!teamsSnap.exists()) return;

  const teams = teamsSnap.val();
  const values = [];

  Object.values(teams).forEach(t => {
    if (typeof t.selectedValue === "number") {
      values.push(t.selectedValue);
    }
  });

  if (values.length === 0) return;

/********************************
 * MASS DUPLICATE RULE (> 2 teams)
 * FARTHEST-FROM-X ELIMINATION
 ********************************/

const pickCounts = {};
Object.values(teams).forEach(t => {
  if (typeof t.selectedValue === "number") {
    pickCounts[t.selectedValue] = (pickCounts[t.selectedValue] || 0) + 1;
  }
});

const hasMassDuplicate = Object.values(pickCounts).some(c => c > 2);

if (hasMassDuplicate) {
  log("MASS DUPLICATE DETECTED — ALL TEAMS LOSE 1 POINT");

  const zeroCandidates = {};

  // First pass: deduct score
  for (const id in teams) {
    let score = teams[id].score ?? 10;
    score -= 1;
    teams[id]._nextScore = score;

    if (score <= 0) {
      zeroCandidates[id] = Math.abs(teams[id].selectedValue);
    }
  }

  // Decide elimination (farthest selectedValue)
  let eliminatedTeamId = null;

  if (Object.keys(zeroCandidates).length > 0) {
    eliminatedTeamId = Object.entries(zeroCandidates)
      .sort((a, b) => b[1] - a[1])[0][0];

    log(`TEAM ${eliminatedTeamId} ELIMINATED (MASS DUPLICATE)`);
  }

  // Second pass: commit scores
  for (const id in teams) {
    let score = teams[id]._nextScore;

    if (score <= 0) {
      if (id === eliminatedTeamId) {
        score = 0;
        await db.ref(`teams/${id}/disqualified`).set(true);
      } else {
        score = 1;
      }
    }

    await db.ref(`teams/${id}/score`).set(score);
  }

  await db.ref("Admin/Xvalue").set(null);
  log("ROUND ENDED — NO WINNER");
  return;
}

/********************************
 * NORMAL GAME LOGIC
 ********************************/

// 🔢 Calculate X value
const avg = values.reduce((a, b) => a + b, 0) / values.length;
const X = +(avg * 0.8).toFixed(2);
await db.ref("Admin/Xvalue").set(X);

log(`X VALUE CALCULATED: ${X}`);

// 🎯 Find exact matches
const exactWinners = [];
let nearestDiff = Infinity;

for (const id in teams) {
  const t = teams[id];
  if (t.selectedValue === X) {
    exactWinners.push(id);
  } else {
    nearestDiff = Math.min(nearestDiff, Math.abs(t.selectedValue - X));
  }
}

/********************************
 * SCORE UPDATE (FARTHEST FROM X)
 ********************************/

const zeroCandidates = {};

// First pass: compute tentative scores
for (const id in teams) {
  const t = teams[id];
  let score = t.score ?? 10;

  if (exactWinners.length > 0) {
    if (exactWinners.includes(id)) score += 1;
    else score -= 1;
  } else {
    if (Math.abs(t.selectedValue - X) !== nearestDiff) score -= 1;
  }

  teams[id]._nextScore = score;

  if (score <= 0) {
    zeroCandidates[id] = Math.abs(t.selectedValue - X);
  }
}

// 🔥 Decide elimination: farthest from X
let eliminatedTeamId = null;

if (Object.keys(zeroCandidates).length > 0) {
  eliminatedTeamId = Object.entries(zeroCandidates)
    .sort((a, b) => b[1] - a[1])[0][0];

  log(`TEAM ${eliminatedTeamId} ELIMINATED (FARTHEST FROM X)`);
}

// Second pass: commit scores
for (const id in teams) {
  let score = teams[id]._nextScore;

  if (score <= 0) {
    if (id === eliminatedTeamId) {
      score = 0;
      await db.ref(`teams/${id}/disqualified`).set(true);
    } else {
      score = 1; // saved by proximity
    }
  }

  await db.ref(`teams/${id}/score`).set(score);
}
}
/********************************
 * END ROUND
 ********************************/
function endRound() {
  db.ref("Admin/roundState").set("ENDED");
  db.ref("Admin/Xvalue").set(null);
  db.ref("Admin/timer").set(30);

  db.ref("teams").once("value", snap => {
    snap.forEach(child => {
      db.ref(`teams/${child.key}/selectedValue`).set(null);
    });
  });
  startNewRound();
  startTimer();
  
  log("ROUND RESET");
}

/********************************
 * RESET GAME
 ********************************/
function resetGame() {
  if (!confirm("RESET ENTIRE GAME?")) return;

  db.ref("Admin").set({
    timer: 30,
    Xvalue: null
  });

  db.ref("teams").once("value", snap => {
    snap.forEach(child => {
      db.ref(`teams/${child.key}`).update({
        score: 10,
        selectedValue: null,
        disqualified: false,
        currentRound: 0
      });
    });
  });

  log("GAME RESET");
}

/********************************
 * LIVE LISTENERS (v8)
 ********************************/

db.ref("Admin/timer").on("value", snap => {
  timerEl.innerText = snap.val() ?? "--";
});

db.ref("Admin/Xvalue").on("value", snap => {
  xValueEl.innerText = snap.exists() ? snap.val() : "--";
});

db.ref("teams").on("value", snap => {
  teamTable.innerHTML = "";

  snap.forEach(child => {
    const t = child.val();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${child.key}</td>
      <td>${t.selectedValue ?? "-"}</td>
      <td>${t.score ?? 10}</td>
      <td>${t.disqualified ? "❌ OUT" : "▶️ PLAYING"}</td>
      <td>
        ${
          t.active
            ? "<span style='color:#4CAF50'>🟢 ONLINE</span>"
            : "<span style='color:#E53935'>🔴 OFFLINE</span>"
        }
      </td>
    `;

    teamTable.appendChild(tr);
  });
});

/********************************
 * LOG HELPER
 ********************************/
function log(msg) {
  logEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
}

/********************************
 * WHEN ADMIN STARTS NEW ROUND
 ********************************/
async function startNewRound() {
  const roundRef = db.ref("Admin/currentRound");
  const snap = await roundRef.get();

  const nextRound = snap.exists() ? snap.val() + 1 : 1;

  await roundRef.set(nextRound);
  await db.ref("Admin/roundState").set("RUNNING");
}
