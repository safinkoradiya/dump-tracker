import { useState } from "react";
import { login } from "../lib/api.js";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const data = await login({ username, password });

      // ✅ STORE EVERYTHING HERE (CORRECT PLACE)
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username);

      // ✅ redirect after login
      window.location.href = "/";

    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="login-page">

      {/* LEFT SIDE */}
      <div className="login-left">
        <h1>DumpTracker</h1>
        <p>Insurance Ops Dashboard</p>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <div className="login-card">
          <h2>Welcome Back</h2>

          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button onClick={handleLogin}>
            Login
          </button>
        </div>
      </div>

    </div>
  );
}
