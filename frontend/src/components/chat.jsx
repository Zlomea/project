import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

export default function Chat({ username, initialRoomId, onLogout }) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [rooms, setRooms] = useState(["general", "tech", "gaming"]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.emit("join", { username, roomId });

    socket.on("message", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("system_message", (msg) => setMessages((prev) => [...prev, msg]));

    return () => {
      socket.off("message");
      socket.off("system_message");
    };
  }, [roomId, username]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    socket.emit("send_message", { roomId, text: message, username });
    setMessage("");
  };

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-4 flex flex-col">
        <h2 className="text-xl font-bold mb-4">Rooms</h2>
        <div className="flex-1 space-y-2">
          {rooms.map((r) => (
            <button
              key={r}
              onClick={() => setRoomId(r)}
              className={`w-full text-left p-2 rounded ${
                r === roomId ? "bg-indigo-500" : "hover:bg-gray-700"
              }`}
            >
              #{r}
            </button>
          ))}
        </div>
        <button
          onClick={onLogout}
          className="mt-auto bg-red-500 hover:bg-red-600 p-2 rounded"
        >
          Logout
        </button>
      </aside>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 p-4 flex justify-between items-center shadow">
          <span className="font-semibold">{username}</span>
          <span className="text-gray-400">Room: #{roomId}</span>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg max-w-md ${
                m.username === username ? "bg-indigo-500 ml-auto text-white" : "bg-gray-700"
              }`}
            >
              {m.username !== username && <div className="text-sm text-gray-300">{m.username}</div>}
              <div>{m.text}</div>
            </div>
          ))}
        </main>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="flex gap-2 p-4 bg-gray-800 border-t border-gray-700"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            className="bg-indigo-500 hover:bg-indigo-600 px-6 py-3 rounded-lg font-semibold"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
