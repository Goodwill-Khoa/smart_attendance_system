import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle } from "../components/BaseLayout";
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

  const headerActions = [
    {
      label: "Back",
      onClick: () => navigate("/teacher-courses"),
      style: {
        border: "1px solid white",
        background: "rgba(0,0,0,0.35)",
        color: "white",
      }
    }
  ];

  return (
    <BaseLayout
      headerTitle="Update Password"
      headerActions={headerActions}
      maxWidth="460px"
      backgroundColor="rgba(0,0,0,0.25)"
    >
      <p style={{ color: "#4b5563", marginTop: 0, marginBottom: "18px", fontSize: "clamp(12px, 1.8vw, 14px)", textAlign: "center" }}>
        Change your password after login or after opening a reset email link.
      </p>

      <input
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        style={{
          ...responsiveInputStyle,
          marginBottom: "12px",
        }}
      />

      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        style={{
          ...responsiveInputStyle,
          marginBottom: "14px",
        }}
      />

      {error && (
        <p style={{ color: "#b91c1c", marginTop: 0, marginBottom: "10px", fontSize: "clamp(12px, 1.8vw, 14px)", textAlign: "center" }}>
          {error}
        </p>
      )}

      {infoMessage && (
        <p style={{ color: "#166534", marginTop: 0, marginBottom: "10px", fontSize: "clamp(12px, 1.8vw, 14px)", textAlign: "center" }}>
          {infoMessage}
        </p>
      )}

      <button
        onClick={handleUpdatePassword}
        disabled={saving}
        style={{
          ...responsiveButtonStyle("#111827", "white"),
          marginBottom: "10px",
        }}
      >
        {saving ? "Saving..." : "Update Password"}
      </button>

      <button
        onClick={() => navigate("/teacher-courses")}
        style={{
          ...responsiveButtonStyle("white", "#111827"),
          border: "1px solid #9ca3af",
        }}
      >
        Back to Dashboard
      </button>
    </BaseLayout>
  );
}
