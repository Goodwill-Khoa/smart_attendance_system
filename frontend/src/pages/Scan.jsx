import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../services/supabase";
import { Html5Qrcode } from "html5-qrcode";
import BaseLayout, { responsiveButtonStyle } from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";

export default function Scan({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, courseName, sessionId } = location.state || {};

  const [result, setResult] = useState("");
  const [status, setStatus] = useState("idle");
  const [emergencyMessage, setEmergencyMessage] = useState("");

  const BASE_URL = getApiBaseUrl();

  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const getDeviceToken = () => {
    let deviceToken = localStorage.getItem("device_id");
    if (!deviceToken) {
      deviceToken = crypto.randomUUID();
      localStorage.setItem("device_id", deviceToken);
    }
    return deviceToken;
  };

  const submitAttendance = async (tokenFromQR) => {
    if (status === "loading") return;

    try {
      setStatus("loading");
      setResult("Submitting...");

      const deviceToken = getDeviceToken();
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ token: tokenFromQR, deviceToken }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setStatus("error");
        setResult("Session expired. Please login again.");
        navigate("/login", { replace: true });
        return;
      }

      if (res.status === 400) {
        setStatus("error");
        setResult("Error: This device already recorded attendance for this session.");
        return;
      }

      if (res.ok && data.success) {
        setStatus("success");
        setResult(data.message || "Attendance recorded.");
      } else {
        const detailText = data.detail || data.message || "Failed to record attendance.";
        if (typeof detailText === "string" && detailText.startsWith("Emergency protocol:")) {
          setEmergencyMessage(detailText.replace("Emergency protocol:", "").trim());
        }
        setStatus("error");
        setResult(detailText);
      }
    } catch (err) {
      setStatus("error");
      setResult("Network error");
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setResult("No active session selected. Please choose a course first.");
      return;
    }

    const readerElement = document.getElementById("reader");
    if (readerElement) {
      readerElement.innerHTML = "";
    }

    const qr = new Html5Qrcode("reader");
    let mounted = true;
    let scannerStarted = false;
    let stopping = false;

    const startScanner = async () => {
      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250, aspectRatio: 1.0 },
          async (decodedText) => {
            if (!mounted || stopping) return;
            stopping = true;

            try {
              if (scannerStarted) {
                await qr.stop();
                await qr.clear();
                scannerStarted = false;
              }
            } catch {
              // Ignore scanner stop races
            }

            if (mounted) {
              submitAttendance(decodedText);
            }
          },
          () => {}
        );
        scannerStarted = true;
      } catch (err) {
        if (mounted) {
          setStatus("error");
          setResult("Camera could not be started. Please allow camera access.");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      (async () => {
        try {
          if (scannerStarted) {
            await qr.stop();
          }
          await qr.clear();
        } catch {
          // Ignore cleanup
        }
      })();
    };
  }, [sessionId]);

  useEffect(() => {
    let mounted = true;

    const fetchEmergencyMessage = async () => {
      try {
        const res = await fetch(`${BASE_URL}/system/emergency-message`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data.active && data.message) {
          setEmergencyMessage(data.message);
        } else {
          setEmergencyMessage("");
        }
      } catch {
        // Keep current state
      }
    };

    fetchEmergencyMessage();
    const timer = setInterval(fetchEmergencyMessage, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [BASE_URL]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/home", { replace: true });
  };

  const headerActions = [
    {
      label: "Logout",
      onClick: handleLogout,
      style: { background: "black" }
    }
  ];

  return (
    <BaseLayout
      headerTitle="Scan Attendance"
      headerActions={headerActions}
      maxWidth="520px"
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px", fontSize: "clamp(18px, 4vw, 22px)" }}>
        Scan QR Code
      </h2>

      <p style={{
        textAlign: "center",
        marginTop: 0,
        marginBottom: "16px",
        color: "#4b5563",
        fontSize: "clamp(12px, 1.8vw, 14px)"
      }}>
        {courseName ? `Active course: ${courseName}` : "Active session scanner"}
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

      <p style={{
        marginBottom: "20px",
        color: "#555",
        textAlign: "center",
        fontSize: "clamp(12px, 1.8vw, 14px)"
      }}>
        Logged in as: <b>{user?.email}</b>
      </p>

      <div
        id="reader"
        style={{
          width: "100%",
          maxWidth: "280px",
          margin: "0 auto 25px",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      />

      <style>{`
        #reader {
          color: #1f2937;
        }

        #reader video {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          border-radius: 16px;
          object-fit: cover;
        }

        #reader canvas,
        #reader img {
          display: none !important;
        }

        #reader__dashboard {
          padding-top: 10px;
        }

        #reader button,
        #reader select {
          color: #1f2937 !important;
          font-size: clamp(12px, 1.8vw, 14px) !important;
        }
      `}</style>

      {result && (
        <p style={{
          color: status === "error" ? "red" : status === "success" ? "green" : "#555",
          fontWeight: "bold",
          textAlign: "center",
          fontSize: "clamp(12px, 1.8vw, 14px)",
          margin: "16px 0 12px"
        }}>
          {status === "loading" ? "⏳ " : status === "success" ? "✅ " : status === "error" ? "❌ " : ""}
          {result}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          onClick={() => navigate("/courses")}
          style={{
            ...responsiveButtonStyle("white", "#1f2937"),
            border: "1px solid #cbd5e1",
            width: "100%"
          }}
        >
          Choose Another Course
        </button>
        <button
          onClick={() => navigate("/student")}
          style={{
            ...responsiveButtonStyle("#10244f", "white"),
            width: "100%"
          }}
        >
          Back to Student Page
        </button>
      </div>
    </BaseLayout>
  );
}
