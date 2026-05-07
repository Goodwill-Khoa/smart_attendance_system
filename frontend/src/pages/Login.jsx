import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";
import { useEffect } from "react";

export default function Login() {
  const navigate = useNavigate();
  //const BASE_URL = "http://127.0.0.1:8000";

  //  Google 登录
  const handleGoogleLogin = async () => {
    // clean session
    await supabase.auth.signOut();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  //  Microsoft login
  const handleMicrosoftLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account"
        }
      }
    });
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
            onClick={() => navigate("/")}
            style={{
              fontSize: "clamp(18px, 4vw, 22px)",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Attendance
          </div>
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
              Use your ELTE account to continue
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
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "#2F2F2F",
                color: "white",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
               <FaMicrosoft size={18} />
              Continue with Microsoft
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}