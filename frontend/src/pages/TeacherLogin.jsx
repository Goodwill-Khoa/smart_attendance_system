import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle } from "../components/BaseLayout";
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

  const headerActions = [
    {
      label: "Home",
      onClick: () => navigate("/home"),
      style: {
        border: "1px solid white",
        background: "rgba(0,0,0,0.35)",
        color: "white",
      }
    }
  ];

  return (
    <BaseLayout
      headerTitle="Teacher Login"
      headerActions={headerActions}
      maxWidth="420px"
    >
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          ...responsiveInputStyle,
          marginBottom: "15px",
        }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          ...responsiveInputStyle,
          marginBottom: "20px",
        }}
      />

      {error && (
        <p style={{ color: "red", marginBottom: "10px", fontSize: "clamp(12px, 1.8vw, 14px)", textAlign: "center" }}>
          {error}
        </p>
      )}

      {infoMessage && (
        <p style={{ color: "#166534", marginBottom: "10px", fontSize: "clamp(12px, 1.8vw, 14px)", textAlign: "center" }}>
          {infoMessage}
        </p>
      )}

      <button
        onClick={handleLogin}
        style={{
          ...responsiveButtonStyle("black", "white"),
          marginBottom: "10px",
        }}
      >
        Login
      </button>

      <button
        onClick={handlePasswordResetRequest}
        style={{
          ...responsiveButtonStyle("white", "black"),
          border: "1px solid #ccc",
        }}
      >
        Request Password Reset
      </button>
    </BaseLayout>
  );
}
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
