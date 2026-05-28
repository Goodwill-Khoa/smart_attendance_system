import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle } from "../components/BaseLayout";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";
import { useState } from "react";

export default function Login() {
  const navigate = useNavigate();
  const azureEnabled = import.meta.env.VITE_ENABLE_AZURE_SSO === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const normalizeAuthError = (message) => {
    if (!message) return "Login failed.";
    if (message.toLowerCase().includes("unsupported provider")) {
      return "This SSO provider is not enabled in Supabase. Use email/password for now, or enable the provider in Supabase Auth settings.";
    }
    return message;
  };

  const handleGoogleLogin = async () => {
    setError("");
    await supabase.auth.signOut();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (oauthError) {
      setError(normalizeAuthError(oauthError.message));
    }
  };

  const handleMicrosoftLogin = async () => {
    setError("");

    if (!azureEnabled) {
      setError("Microsoft SSO is not enabled for this project. Use email/password for now.");
      return;
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (oauthError) {
      setError(normalizeAuthError(oauthError.message));
    }
  };

  const handlePasswordLogin = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError(normalizeAuthError(loginError.message));
      return;
    }

    navigate("/student", { replace: true });
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
      headerTitle="Attendance"
      headerActions={headerActions}
      maxWidth="420px"
    >
      <h2
        style={{
          marginBottom: "10px",
          fontSize: "clamp(22px, 4vw, 28px)",
          color: "#111827",
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        Sign In
      </h2>

      <p
        style={{
          marginBottom: "30px",
          color: "#555",
          fontSize: "clamp(14px, 2.5vw, 16px)",
          textAlign: "center",
        }}
      >
        Students must use ELTE Microsoft SSO with an *.elte.hu email.
      </p>

      {/* Google Login */}
      <button
        onClick={handleGoogleLogin}
        style={{
          width: "100%",
          padding: "clamp(12px, 2vw, 14px)",
          borderRadius: "12px",
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          fontSize: "clamp(14px, 2vw, 16px)",
          marginBottom: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <FcGoogle size={20} />
        Continue with Google
      </button>

      {/* Microsoft Login */}
      <button
        onClick={handleMicrosoftLogin}
        disabled={!azureEnabled}
        title={azureEnabled ? "Microsoft SSO" : "Microsoft SSO is disabled"}
        style={{
          width: "100%",
          padding: "clamp(12px, 2vw, 14px)",
          borderRadius: "12px",
          border: "none",
          background: azureEnabled ? "#2F2F2F" : "#9ca3af",
          color: "white",
          cursor: azureEnabled ? "pointer" : "not-allowed",
          fontSize: "clamp(14px, 2vw, 16px)",
          opacity: azureEnabled ? 1 : 0.85,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <FaMicrosoft size={18} />
        {azureEnabled ? "Continue with Microsoft" : "Microsoft SSO (Disabled)"}
      </button>

      <div
        style={{
          margin: "18px 0 10px",
          color: "#777",
          fontSize: "clamp(12px, 1.8vw, 13px)",
          textAlign: "center",
        }}
      >
        Or sign in with email/password
      </div>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          ...responsiveInputStyle,
          marginBottom: "10px",
        }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          ...responsiveInputStyle,
          marginBottom: "12px",
        }}
      />

      <button
        onClick={handlePasswordLogin}
        style={{
          ...responsiveButtonStyle("#10316b", "white"),
        }}
      >
        Sign in with Email
      </button>

      {error && (
        <p style={{ color: "#b00020", marginTop: "12px", fontSize: "clamp(12px, 1.8vw, 14px)", textAlign: "center" }}>
          {error}
        </p>
      )}
    </BaseLayout>
  );
}
