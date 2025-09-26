import React, { useState } from "react";
import Login from "./components/Login";
import Chat from "./components/Chat";

export default function App() {
  const [session, setSession] = useState(() => ({
    username: localStorage.getItem("username") || "",
    roomId: localStorage.getItem("roomId") || "general",
  }));

  if (!session.username) {
    return (
      <Login
        onLogin={(username, roomId) => {
          localStorage.setItem("username", username);
          localStorage.setItem("roomId", roomId);
          setSession({ username, roomId });
        }}
      />
    );
  }

  return (
    <Chat
      username={session.username}
      initialRoomId={session.roomId}
      onLogout={() => {
        localStorage.removeItem("username");
        localStorage.removeItem("roomId");
        setSession({ username: "", roomId: "general" });
      }}
    />
  );
}
