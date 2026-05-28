import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getApiBaseUrl } from "../services/apiBase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const BASE_URL = getApiBaseUrl();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setInfoMessage("");
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setLoading(false);
      setError(loginError.message || "Invalid credentials");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    try {
      const res = await fetch(`${BASE_URL}/admin/auth/check`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        await supabase.auth.signOut();
        setError(payload.detail || "Admin access denied.");
        setLoading(false);
        return;
      }

      if (payload.isBootstrap) {
        setInfoMessage("Bootstrap admin access granted. Assign a permanent admin from the dashboard.");
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(err);
      await supabase.auth.signOut();
      setError("Network error while verifying admin access.");
    } finally {
      setLoading(false);
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
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.3)",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, minHeight: "100vh" }}>
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
              Admin Login
            </h2>

            <p style={{ color: "#4b5563", fontSize: "14px", marginTop: 0, marginBottom: "18px" }}>
              Uses the same Supabase username and password flow as the teacher login.
            </p>

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

            {error && <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>}
            {infoMessage && <p style={{ color: "#166534", marginBottom: "10px" }}>{infoMessage}</p>}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "20px",
                background: "black",
                color: "white",
                border: "none",
                cursor: "pointer",
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? "Checking..." : "Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}