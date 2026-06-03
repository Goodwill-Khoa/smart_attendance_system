import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle } from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";
import { AUTH_ROLES, setAuthRole } from "../services/authRole";
import { syncAuthenticatedUser } from "../services/authSync";

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

      await syncAuthenticatedUser("TEACHER", token);

      setAuthRole(AUTH_ROLES.ADMIN);
      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(err);
      await supabase.auth.signOut();
      setError("Network error while verifying admin access.");
    } finally {
      setLoading(false);
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
      headerTitle="Admin Login"
      headerActions={headerActions}
      maxWidth="420px"
      backgroundColor="rgba(0,0,0,0.3)"
    >
      <p style={{ color: "#4b5563", fontSize: "clamp(13px, 1.8vw, 14px)", marginTop: 0, marginBottom: "18px", textAlign: "center" }}>
        Uses the same Supabase username and password flow as the teacher login.
      </p>

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
        disabled={loading}
        style={{
          ...responsiveButtonStyle("black", "white"),
          opacity: loading ? 0.75 : 1,
        }}
      >
        {loading ? "Checking..." : "Login"}
      </button>
    </BaseLayout>
  );
}