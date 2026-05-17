// bot.js
const { io } = require("socket.io-client");

const TARGET_URL = "https://your-target-site.com";

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // cap at 30 seconds
const BASE_DELAY = 3000;

function getBackoffDelay() {
  // Exponential backoff: 3s, 6s, 12s, 24s, 30s (capped)
  const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  return delay;
}

function connect() {
  console.log(`🔄 Connecting to ${TARGET_URL}...`);

  socket = io(TARGET_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: BASE_DELAY,
    reconnectionDelayMax: MAX_RECONNECT_DELAY,
    timeout: 10000,
    transports: ["websocket", "polling"], // fallback to polling if websocket fails
  });

  socket.on("connect", () => {
    console.log("✅ Bot connected:", socket.id);
    reconnectAttempts = 0; // reset backoff counter on successful connect
  });

  socket.on("disconnect", (reason) => {
    console.log(`⚠️  Disconnected: ${reason}`);

    // socket.io handles most cases, but manually reconnect for server-side kicks
    if (reason === "io server disconnect") {
      const delay = getBackoffDelay();
      console.log(`🔁 Server closed connection. Retrying in ${delay / 1000}s...`);
      setTimeout(() => socket.connect(), delay);
    }
  });

  socket.on("connect_error", (err) => {
    const delay = getBackoffDelay();
    console.error(`❌ Connection error: ${err.message}. Retrying in ${delay / 1000}s...`);
  });

  socket.on("reconnect", (attempt) => {
    console.log(`✅ Reconnected after ${attempt} attempt(s)`);
    reconnectAttempts = 0;
  });

  socket.on("reconnect_attempt", (attempt) => {
    console.log(`🔄 Reconnect attempt #${attempt}...`);
  });

  socket.on("reconnect_failed", () => {
    console.error("💥 All reconnect attempts failed. Restarting connection from scratch...");
    reconnectAttempts = 0;
    setTimeout(connect, BASE_DELAY);
  });

  // ── Your custom event handlers below ──────────────────────────
  socket.on("some-event", (data) => {
    console.log("📩 Received:", data);
    // handle incoming data
  });
}

// ── Process-level crash recovery ────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
  if (socket) socket.disconnect();
  setTimeout(connect, BASE_DELAY);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Promise Rejection:", reason);
});

// ── Keep-alive heartbeat log ─────────────────────────────────────
setInterval(() => {
  const status = socket?.connected ? "🟢 CONNECTED" : "🔴 DISCONNECTED";
  console.log(`[Heartbeat] ${new Date().toISOString()} — ${status}`);
}, 60000); // log every 60 seconds

// ── Start ────────────────────────────────────────────────────────
connect();
