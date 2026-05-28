import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../services/supabase";
import { QRCodeCanvas } from "qrcode.react";
import BaseLayout, { responsiveButtonStyle } from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";

export default function Teacher() {
  const [qrData, setQrData] = useState("");
  const [error, setError] = useState("");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const location = useLocation();
  const { sessionId, courseName } = location.state || {};
  const navigate = useNavigate();

  const BASE_URL = getApiBaseUrl();

  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const fetchQR = async () => {
    if (!sessionId) {
      setError("Missing session. Please start a session again.");
      return;
    }

    try {
      setError("");
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/qr/${sessionId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        const detailText = details.detail || "Failed to fetch QR token";
        if (detailText.startsWith("Emergency protocol:")) {
          setEmergencyMessage(detailText.replace("Emergency protocol:", "").trim());
        }
        throw new Error(detailText);
      }

      const data = await res.json();
      setQrData(data.token);
    } catch (err) {
      setError(err.message || "Failed to load QR code.");
    }
  };

  const fetchEmergencyMessage = async () => {
    try {
      const res = await fetch(`${BASE_URL}/system/emergency-message`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.active && data.message) {
        setEmergencyMessage(data.message);
      } else {
        setEmergencyMessage("");
      }
    } catch {
      // Keep current state
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    fetchQR();
    fetchEmergencyMessage();
    const interval = setInterval(() => {
      fetchQR();
      fetchEmergencyMessage();
    }, 10000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const handleExport = () => {
    window.open(`${BASE_URL}/sessions/${sessionId}/export`, "_blank");
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      const jwt = await getJWT();
      const res = await fetch(`${BASE_URL}/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) {
        throw new Error("Failed to end session");
      }

      navigate("/teacher-courses", { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  const headerActions = [
    {
      label: "Export",
      onClick: handleExport,
      style: { background: "white", color: "#0f1f44", border: "1px solid #b5c5f0" }
    },
    {
      label: "Logout",
      onClick: handleLogout,
      style: { background: "#0f1f44" }
    }
  ];

  return (
    <BaseLayout
      headerTitle="Live QR Session"
      headerActions={headerActions}
      maxWidth="640px"
      backgroundColor="rgba(237, 242, 255, 0.9)"
    >
      <h2 style={{
        textAlign: "center",
        marginBottom: "12px",
        fontSize: "clamp(24px, 5vw, 36px)",
        color: "#0f1f44"
      }}>
        {courseName ? courseName : "Attendance Session"}
      </h2>

      <p style={{
        textAlign: "center",
        marginBottom: "22px",
        color: "#42527a",
        fontSize: "clamp(13px, 1.8vw, 15px)"
      }}>
        Students scan this QR code to check in.
      </p>

      {emergencyMessage && (
        <div style={{
          marginBottom: "14px",
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "#991b1b",
          borderRadius: "12px",
          padding: "clamp(10px, 2vw, 14px)",
          fontWeight: 700,
          fontSize: "clamp(12px, 1.8vw, 14px)",
          textAlign: "center"
        }}>
          ⚠️ {emergencyMessage}
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: "15px",
          color: "#a61d24",
          fontWeight: "bold",
          textAlign: "center",
          fontSize: "clamp(12px, 1.8vw, 14px)"
        }}>
          {error}
        </div>
      )}

      <div style={{
        width: "min(78vw, 460px)",
        height: "min(78vw, 460px)",
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 18px 45px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 22px",
        overflow: "hidden"
      }}>
        {qrData ? (
          <QRCodeCanvas
            value={qrData}
            size={Math.min(420, Math.max(300, window.innerWidth * 0.7))}
            includeMargin={true}
          />
        ) : (
          <span style={{ color: "#666", fontSize: "clamp(14px, 2vw, 16px)" }}>
            Loading QR...
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={fetchQR}
          style={{
            ...responsiveButtonStyle("#0f1f44", "white"),
            width: "100%"
          }}
        >
          Refresh QR
        </button>

        <p style={{
          marginTop: "0",
          marginBottom: "0",
          fontSize: "clamp(12px, 1.8vw, 13px)",
          color: "#555",
          textAlign: "center"
        }}>
          Auto refresh every 10 seconds
        </p>
      </div>

      <button
        onClick={handleEndSession}
        style={{
          ...responsiveButtonStyle("#c62828", "white"),
          width: "100%",
          fontWeight: "bold",
          boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
          marginTop: "16px"
        }}
      >
        End Session
      </button>
    </BaseLayout>
  );
}
