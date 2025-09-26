import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("general");

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) return;
    onLogin(username.trim(), room);
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-r from-purple-700 to-indigo-700">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-2xl shadow-xl flex flex-col gap-6 w-96"
      >
        <h2 className="text-2xl font-bold text-white text-center">Welcome to Chat</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-3 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="p-3 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="general">general</option>
          <option value="tech">tech</option>
          <option value="gaming">gaming</option>
        </select>
        <button
          type="submit"
          className="bg-indigo-500 hover:bg-indigo-600 transition px-4 py-3 rounded-lg font-semibold shadow-md"
        >
          Join
        </button>
      </form>
    </div>
  );
}
