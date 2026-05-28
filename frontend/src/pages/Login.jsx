import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
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

  //  Google 登录
  const handleGoogleLogin = async () => {
    setError("");

    // clean session
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

  //  Microsoft login
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
      {/* 遮罩 */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.2)",
          pointerEvents: "none"
        }}
      />

      <div style={{ position: "relative", zIndex: 10 }}>

        {/* 顶部导航 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "clamp(20px, 4vw, 40px) 5vw",
            color: "white",
            alignItems: "center",
          }}
        >
          <div
            onClick={() => navigate("/home")}
            style={{
              fontSize: "clamp(18px, 4vw, 22px)",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Attendance
          </div>

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

        {/* 登录卡片 */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "80vh",
          }}
        >
          <div
            style={{
              width: "90%",
              maxWidth: "420px",
              padding: "clamp(25px, 5vw, 50px)",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(12px)",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2
              style={{
                marginBottom: "10px",
                fontSize: "clamp(22px, 4vw, 28px)",
                color: "#111827",
                fontWeight: 800,
              }}
            >
              Sign In
            </h2>

            <p
              style={{
                marginBottom: "30px",
                color: "#555",
                fontSize: "clamp(14px, 2.5vw, 16px)",
              }}
            >
              Students must use ELTE Microsoft SSO with an *.elte.hu email.
            </p>

            {/* Google 登录 */}
            <button
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontSize: "16px",
                marginBottom: "15px"
              }}
            >
              <FcGoogle size={20} />
              Continue with Google
            </button>

            {/* Microsoft 登录 */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={!azureEnabled}
              title={azureEnabled ? "Microsoft SSO" : "Microsoft SSO is disabled"}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: azureEnabled ? "#2F2F2F" : "#9ca3af",
                color: "white",
                cursor: azureEnabled ? "pointer" : "not-allowed",
                fontSize: "16px",
                opacity: azureEnabled ? 1 : 0.85,
              }}
            >
              <FaMicrosoft size={18} />
              {azureEnabled ? "Continue with Microsoft" : "Microsoft SSO (Disabled)"}
            </button>

            <div
              style={{
                margin: "18px 0 10px",
                color: "#777",
                fontSize: "13px",
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
                width: "100%",
                padding: "12px",
                marginBottom: "10px",
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
                marginBottom: "12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
              }}
            />

            <button
              onClick={handlePasswordLogin}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: "#10316b",
                color: "white",
                cursor: "pointer",
                fontSize: "15px",
              }}
            >
              Sign in with Email
            </button>

            {error && (
              <p style={{ color: "#b00020", marginTop: "12px", fontSize: "14px" }}>
                {error}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
