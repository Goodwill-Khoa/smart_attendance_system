import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getApiBaseUrl } from "../services/apiBase";

export default function TeacherPassword() {
  const navigate = useNavigate();
  const BASE_URL = getApiBaseUrl();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleUpdatePassword = async () => {
    setError("");
    setInfoMessage("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password.");
        return;
      }

      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email;
      if (email) {
        await fetch(`${BASE_URL}/lecturers/password-policy/clear`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      }

      setInfoMessage("Password updated successfully. You can continue to Teacher Dashboard.");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSaving(false);
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
          background: "rgba(0,0,0,0.25)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "460px",
            padding: "32px",
            borderRadius: "22px",
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "8px", color: "#111827" }}>
            Lecturer Password
          </h2>
          <p style={{ color: "#4b5563", marginTop: 0, marginBottom: "18px" }}>
            Change your password after login or after opening a reset email link.
          </p>

          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
            }}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "14px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
            }}
          />

          {error && <p style={{ color: "#b91c1c", marginTop: 0 }}>{error}</p>}
          {infoMessage && <p style={{ color: "#166534", marginTop: 0 }}>{infoMessage}</p>}

          <button
            onClick={handleUpdatePassword}
            disabled={saving}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              border: "none",
              background: "#111827",
              color: "white",
              cursor: "pointer",
              marginBottom: "10px",
            }}
          >
            {saving ? "Saving..." : "Update Password"}
          </button>

          <button
            onClick={() => navigate("/teacher-courses")}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              border: "1px solid #9ca3af",
              background: "white",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            Back to Teacher Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
