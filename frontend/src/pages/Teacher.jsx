import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useLocation } from "react-router-dom";

export default function Teacher() {
  const [qrData, setQrData] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();

  //  mock / real 切换
  const BASE_URL = "mock"; // debug
  //const BASE_URL = "http://127.0.0.1:8000"; 

  //  获取 JWT
  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    console.log("JWT:", data.session?.access_token); //debug
    return data.session?.access_token;
  };

  //  创建 session
  const createSession = async () => {
    if (BASE_URL === "mock") {
      const fakeId = "mock-session-" + Date.now();
      console.log("Generated session:", fakeId); //debug
      setSessionId(fakeId);
      return;
    }

    try {
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          name: "Lecture " + new Date().toLocaleString(),
        }),
      });

      const data = await res.json();
      setSessionId(data.sessionId);
    } catch (err) {
      console.error(err);
    }
  };

  // end session
  const location = useLocation();
  const { courseName } = location.state || {};
  const handleEndSession = async () => {
    try {
      // ===== MOCK =====
      if (BASE_URL === "mock") {
        navigate("/teacher-courses");
        return;
      }

      const jwt = await getJWT();

      const res = await fetch(
        `${BASE_URL}/sessions/${sessionId}/end`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        navigate("/teacher-courses");
      } else {
        alert(data.message || "Failed to end session.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  //  获取 QR token
  const fetchQR = async () => {
    if (!sessionId) return;

    if (BASE_URL === "mock") {
      const token = "mock-token-" + Date.now();
      console.log("QR Token:", token); //debug
      setQrData(token);
      return;
    }

    try {
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/qr/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      const data = await res.json();
      setQrData(data.token);
    } catch (err) {
      console.error(err);
    }
  };

  //  初始化 session
  useEffect(() => {
    createSession();
  }, []);

  //  自动刷新 QR
  useEffect(() => {
    if (!sessionId) return;

    fetchQR();
    const interval = setInterval(fetchQR, 8000);

    return () => clearInterval(interval);
  }, [sessionId]);

  //  登出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  //  导出
  const handleExport = () => {
    alert("Exporting attendance data...");
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
            padding: "20px 120px",
            color: "white",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>
            Teacher Panel
          </div>

          <div>
            <button
              onClick={handleExport}
              style={{
                marginRight: "10px",
                padding: "10px 18px",
                borderRadius: "20px",
                background: "white",
                color: "black",
                border: "none",
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
                background: "black",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
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
              width: "520px",
              padding: "50px",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ marginBottom: "30px", fontSize: "26px" }}>
              Live QR Code
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {qrData && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${qrData}`}
                  alt="QR Code"
                  style={{ marginBottom: "25px" }}
                />
              )}

              <button
                onClick={fetchQR}
                style={{
                  padding: "14px 30px",
                  borderRadius: "20px",
                  background: "black",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Refresh QR
              </button>

              <button
                onClick={handleEndSession}
                style={{
                  marginTop: "16px",
                  padding: "14px 30px",
                  borderRadius: "20px",
                  background: "#c62828",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                End Session
              </button>
              
            </div>

            <p style={{ marginTop: "15px", fontSize: "13px", color: "#555" }}>
              Auto refresh every 8 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}