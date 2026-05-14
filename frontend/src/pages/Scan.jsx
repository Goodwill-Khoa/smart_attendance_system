import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { Html5Qrcode } from "html5-qrcode";
import { useLocation } from "react-router-dom";

export default function Scan({ user }) {
  const navigate = useNavigate();

  const [result, setResult] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [scanned, setScanned] = useState(false); 

  const location = useLocation();
  const { courseId, courseName, sessionId } = location.state || {};

  const BASE_URL ="mock"  //debug
//const BASE_URL = "http://127.0.0.1:8000";

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

      // mock
      if (BASE_URL === "mock") {
        await new Promise((r) => setTimeout(r, 500));
        setStatus("success");
        setResult("Attendance recorded");
        return;
      }

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
        setStatus("error");
        setResult(data.message || "Failed to record attendance.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setResult("Network error");
    }
  };

  // scan
  useEffect(() => {
    const qr = new Html5Qrcode("reader");
    let isScanning = true;

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        if (!isScanning) return;
        isScanning = false;

        console.log("Scanned:", decodedText);

        submitAttendance(decodedText);

        qr.stop().catch(() => {});
      },
      () => {}
    );

    return () => {
      if (isScanning) {
        qr.stop().catch(() => {});
      };
    };
  }, []);

  // logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url('/bg.jpg')",
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
            onClick={() => navigate("/")}
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
          </div>
        </div>
      </div>
    </div>
  );
}