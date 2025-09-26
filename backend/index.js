const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const adapter = new FileSync("db.json");
const db = low(adapter);
db.defaults({ users: [], messages: [] }).write();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const DB_FILE = path.join(__dirname, "db.json");




const app = express();
app.use(cors());
app.use(express.json());

// Simple auth middleware (optional)
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing Authorization header" });
  const parts = auth.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "Bad Authorization header" });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Register endpoint
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  await db.read();
  const exists = db.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return res.status(409).json({ error: "username_taken" });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now().toString(), username, passwordHash: hash, createdAt: Date.now(), lastSeen: null };
  db.data.users.push(user);
  await db.write();
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  await db.read();
  const user = db.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Public messages endpoint (requires auth for history)
app.get("/api/messages", authMiddleware, async (req, res) => {
  await db.read();
  // return last 200 messages
  const msgs = (db.data.messages || []).slice(-200);
  res.json({ messages: msgs });
});

// Serve static frontend if folder exists
const frontendPath = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));
}

// Create HTTP server and socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// Maps for tracking users
const socketsByUsername = new Map();
const usersBySocket = new Map();

// Socket authentication via token sent in auth payload
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error("auth error: missing token"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    return next();
  } catch (err) {
    return next(new Error("auth error: invalid token"));
  }
});

io.on("connection", async (socket) => {
  await db.read();
  const username = socket.user.username;
  console.log("socket connected:", username, socket.id);
  socketsByUsername.set(username, socket.id);
  usersBySocket.set(socket.id, username);

  // update lastSeen
  const u = db.data.users.find(x => x.username === username);
  if (u) { u.lastSeen = Date.now(); await db.write(); }

  // send recent messages to the connected client
  const recent = (db.data.messages || []).slice(-200);
  socket.emit("messages:history", recent);

  // notify all clients about user join (simple system message)
  const joinMsg = { id: "sys-" + Date.now(), user: "system", text: `${username} joined the chat`, createdAt: Date.now(), system: true };
  io.emit("chat:message", joinMsg);

  socket.on("chat:message", async (payload) => {
    const text = (payload && payload.text) ? String(payload.text).slice(0,1000) : "";
    if (!text) return;
    const msg = { id: Date.now().toString(), user: username, text, createdAt: Date.now() };
    // persist
    await db.read();
    db.data.messages = db.data.messages || [];
    db.data.messages.push(msg);
    // keep only last 1000 messages
    if (db.data.messages.length > 2000) db.data.messages = db.data.messages.slice(-2000);
    await db.write();
    // broadcast to all
    io.emit("chat:message", msg);
  });

  socket.on("disconnect", async () => {
    console.log("socket disconnected:", username, socket.id);
    socketsByUsername.delete(username);
    usersBySocket.delete(socket.id);
    await db.read();
    const user = db.data.users.find(x => x.username === username);
    if (user) { user.lastSeen = Date.now(); await db.write(); }
    const leftMsg = { id: "sys-" + Date.now(), user: "system", text: `${username} left the chat`, createdAt: Date.now(), system: true };
    io.emit("chat:message", leftMsg);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Server running on port", PORT));
