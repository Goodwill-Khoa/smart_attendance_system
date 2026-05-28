import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useLocation } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { getApiBaseUrl } from "../services/apiBase";

export default function Teacher() {
  const [qrData, setQrData] = useState("");
  const [error, setError] = useState("");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const location = useLocation();
  const { sessionId, courseName } = location.state || {};
  const navigate = useNavigate();

  const BASE_URL = getApiBaseUrl();

  //  获取 JWT
  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    console.log("JWT:", data.session?.access_token); //debug
    return data.session?.access_token;
  };

  //  获取 QR token
  const fetchQR = async () => {
    if (!sessionId) {
      setError("Missing session. Please start a session again.");
      return;
    }

    try {
      setError("");
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/qr/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
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
      console.error(err);
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
      // Keep current state if endpoint is temporarily unavailable.
    }
  };
  
  //  自动刷新 QR
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

  //  登出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  // export csv
  const handleExport = () => {
    window.open(
      `${BASE_URL}/sessions/${sessionId}/export`,
      "_blank"
    );
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      const jwt = await getJWT();
      const res = await fetch(`${BASE_URL}/sessions/${sessionId}/end`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to end session");
      }

      navigate("/teacher-courses", { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #edf2ff 0%, #dce7ff 100%)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "18px 24px",
          color: "#0f1f44",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>
          Live Session QR
        </div>

        <div>
          <button
            onClick={handleExport}
            style={{
              marginRight: "10px",
              padding: "10px 18px",
              borderRadius: "20px",
              background: "white",
              color: "#0f1f44",
              border: "1px solid #b5c5f0",
              cursor: "pointer",
            }}
          >
            Export
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: "10px 18px",
              borderRadius: "20px",
              background: "#0f1f44",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: "110px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: "10px", fontSize: "36px", color: "#0f1f44" }}>
            {courseName ? `${courseName}` : "Attendance Session"}
          </h2>
          <p style={{ marginBottom: "22px", color: "#42527a" }}>
            Students scan this QR code to check in.
          </p>

          {emergencyMessage && (
            <div
              style={{
                marginBottom: "14px",
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: "12px",
                padding: "10px 12px",
                fontWeight: 700,
              }}
            >
              Emergency protocol message: {emergencyMessage}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "15px",
                color: "#a61d24",
                fontWeight: "bold",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              width: "min(78vw, 520px)",
              height: "min(78vw, 520px)",
              background: "white",
              borderRadius: "20px",
              boxShadow: "0 18px 45px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            {qrData ? (
              <QRCodeCanvas value={qrData} size={420} includeMargin={true} />
            ) : (
              <span style={{ color: "#666" }}>Loading QR...</span>
            )}
          </div>

          <button
            onClick={fetchQR}
            style={{
              marginTop: "18px",
              padding: "12px 24px",
              borderRadius: "20px",
              background: "#0f1f44",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Refresh QR
          </button>
          <p style={{ marginTop: "10px", fontSize: "13px", color: "#555" }}>
            Auto refresh every 10 seconds
          </p>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <button
          onClick={handleEndSession}
          style={{
            padding: "14px 34px",
            borderRadius: "24px",
            background: "#c62828",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
          }}
        >
          End Session
        </button>
      </div>
    </div>
  );
}