import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { Html5Qrcode } from "html5-qrcode";
import { useLocation } from "react-router-dom";
import { getApiBaseUrl } from "../services/apiBase";

export default function Scan({ user }) {
  const navigate = useNavigate();

  const [result, setResult] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [emergencyMessage, setEmergencyMessage] = useState("");

  const location = useLocation();
  const { courseId, courseName, sessionId } = location.state || {};

  const BASE_URL = getApiBaseUrl();

  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  // device_id
  const getDeviceToken = () => {
    let deviceToken = localStorage.getItem("device_id"); // device_id

    if (!deviceToken) {
      deviceToken = crypto.randomUUID();
      localStorage.setItem("device_id", deviceToken);
      console.log("New device_id:", deviceToken);
    } else {
      console.log("Existing device_id:", deviceToken);
    }

    return deviceToken;
  };

  // 提交签到
  const submitAttendance = async (tokenFromQR) => {
    if (status === "loading") return; // 防重复提交

    try {
      setStatus("loading");
      setResult("Submitting...");

      const deviceToken = getDeviceToken();

      console.log("Sending:", {
        token: tokenFromQR,
        deviceToken,
      });

      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          token: tokenFromQR,
          deviceToken,
        }),
      });

      const data = await res.json();
      console.log("STATUS:", res.status);
      console.log("RESPONSE:", data);

      // 401
      if (res.status === 401) {
        setStatus("error");
        setResult("Session expired. Please login again.");
        navigate("/login", { replace: true });
        return;
      }

      //  duplicate scan 400
      if (res.status === 400) {
        setStatus("error");
        setResult(
          "Error: This device has already been used to record attendance for this session."
        );
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
      console.error(err);
      setStatus("error");
      setResult("Network error");
    }
  };

  // scan
  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setResult("No active session selected. Please choose a course first.");
      return;
    }

    const readerElement = document.getElementById("reader");
    if (readerElement) {
      // Prevent duplicate preview elements when navigating back/forth to this page.
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
              // Ignore scanner stop races triggered by rapid unmount/navigation.
            }

            if (mounted) {
              console.log("Scanned:", decodedText);
              submitAttendance(decodedText);
            }
          },
          () => {}
        );
        scannerStarted = true;
      } catch (err) {
        console.error(err);
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
          // Ignore cleanup stop errors if scanner is already stopped.
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
        // Keep current state if endpoint is temporarily unavailable.
      }
    };

    fetchEmergencyMessage();
    const timer = setInterval(fetchEmergencyMessage, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [BASE_URL]);

  // logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/home", { replace: true });
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
          pointerEvents: "none",
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
            onClick={handleLogout}
            style={{
              padding: "clamp(10px, 2.5vw, 16px) clamp(20px, 6vw, 40px)",
              fontSize: "clamp(14px, 3vw, 18px)",
              borderRadius: "20px",
              background: "black",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        {/* 主体 */}
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
              maxWidth: "520px",
              padding: "clamp(20px, 5vw, 50px)",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ marginBottom: "10px" }}>Scan QR Code</h2>

            <p style={{ marginTop: 0, marginBottom: "10px", color: "#4b5563" }}>
              {courseName ? `Active course: ${courseName}` : "Active session scanner"}
            </p>

            {emergencyMessage && (
              <div
                style={{
                  marginBottom: "12px",
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

            <p style={{ marginBottom: "20px", color: "#555" }}>
              Logged in as: <b>{user?.email}</b>
            </p>

            <div
              id="reader"
              style={{
                width: "100%",
                maxWidth: "260px",
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
              }
            `}</style>

            {result && (
              <p
                style={{
                  color:
                    status === "error"
                      ? "red"
                      : status === "success"
                      ? "green"
                      : "#555",
                  fontWeight: "bold",
                }}
              >
                {status === "loading"
                  ? "⏳ "
                  : status === "success"
                  ? "✅ "
                  : status === "error"
                  ? "❌ "
                  : ""}
                {result}
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                marginTop: "18px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => navigate("/courses")}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  padding: "10px 16px",
                  background: "white",
                  color: "#1f2937",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Choose Another Course
              </button>
              <button
                onClick={() => navigate("/student")}
                style={{
                  border: "none",
                  borderRadius: "12px",
                  padding: "10px 16px",
                  background: "#10244f",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Back to Student Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
