const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const adapter = new FileSync("db.json");
const db = low(adapter);

// Initialize defaults
db.defaults({ users: [], messages: [] }).write();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const app = express();
app.use(cors());
app.use(express.json());

// ---- AUTH MIDDLEWARE ----
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

// ---- REGISTER ----
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const exists = db.get("users").find({ username }).value();
  if (exists) return res.status(409).json({ error: "username_taken" });

  const hash = bcrypt.hashSync(password, 10);
  const user = { id: Date.now().toString(), username, passwordHash: hash, createdAt: Date.now(), lastSeen: null };

  db.get("users").push(user).write();

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// ---- LOGIN ----
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const user = db.get("users").find({ username }).value();
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// ---- GET MESSAGES ----
app.get("/api/messages", authMiddleware, (req, res) => {
  const msgs = db.get("messages").takeRight(200).value();
  res.json({ messages: msgs });
});

// ---- FRONTEND (if exists) ----
const frontendPath = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));
}

// ---- SOCKET.IO ----
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

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

io.on("connection", (socket) => {
  const username = socket.user.username;
  console.log("socket connected:", username);

  // Send recent messages
  const recent = db.get("messages").takeRight(200).value();
  socket.emit("messages:history", recent);

  // Broadcast join
  const joinMsg = { id: "sys-" + Date.now(), user: "system", text: `${username} joined the chat`, createdAt: Date.now(), system: true };
  db.get("messages").push(joinMsg).write();
  io.emit("chat:message", joinMsg);

  socket.on("chat:message", (payload) => {
    const text = (payload && payload.text) ? String(payload.text).slice(0, 1000) : "";
    if (!text) return;

    const msg = { id: Date.now().toString(), user: username, text, createdAt: Date.now() };
    db.get("messages").push(msg).write();
    io.emit("chat:message", msg);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", username);
    const leftMsg = { id: "sys-" + Date.now(), user: "system", text: `${username} left the chat`, createdAt: Date.now(), system: true };
    db.get("messages").push(leftMsg).write();
    io.emit("chat:message", leftMsg);
  });
});

// ---- START ----
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Server running on port", PORT));
