import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getApiBaseUrl } from "../services/apiBase";

export default function TeacherLogin() {
  const navigate = useNavigate();
  const BASE_URL = getApiBaseUrl();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleLogin = async () => {
    setError("");
    setInfoMessage("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message || "Invalid credentials");
      return;
    }

    navigate("/teacher-courses");
  };

  const handlePasswordResetRequest = async () => {
    setError("");
    setInfoMessage("");

    if (!email.trim()) {
      setError("Please enter your lecturer email first.");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/lecturers/password-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to submit password request.");
        return;
      }

      setInfoMessage(data.message || "Password request sent to admin.");
    } catch (err) {
      console.error(err);
      setError("Network error while requesting password reset.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url('/ELTELogo.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* mask */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.2)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "24px 5vw 0",
          }}
        >
          <button
            onClick={() => navigate("/home")}
            style={{
              padding: "10px 18px",
              borderRadius: "18px",
              border: "1px solid white",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Home
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "calc(100vh - 70px)",
          }}
        >
        {/* caed */}
        <div
          style={{
            width: "90%",
            maxWidth: "420px",
            padding: "40px",
            borderRadius: "24px",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          <h2
            style={{
              marginBottom: "20px",
              color: "#111827",
              fontWeight: 800,
            }}
          >
            Teacher Login
          </h2>

          {/* input */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "15px",
              borderRadius: "10px",
              border: "1px solid #ccc",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "10px",
              border: "1px solid #ccc",
            }}
          />

          {/* error */}
          {error && (
            <p style={{ color: "red", marginBottom: "10px" }}>
              {error}
            </p>
          )}

          {infoMessage && (
            <p style={{ color: "#166534", marginBottom: "10px" }}>
              {infoMessage}
            </p>
          )}

          {/* button */}
          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "20px",
              background: "black",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Login
          </button>

          <button
            onClick={handlePasswordResetRequest}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              background: "transparent",
              color: "#111827",
              border: "1px solid #9ca3af",
              cursor: "pointer",
            }}
          >
            Request Password Reset
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
