import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      backgroundImage: "url('/bg.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    }}>

      {/* 遮罩 */}
      <div style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        background: "linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.4))",
        pointerEvents: "none"
        
      }} />

      {/* 内容 */}
      <div style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        color: "white"
      }}>

        {/*导航 */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          //padding: "20px 120px"
          padding:"30px 5vw",
          marginTop: "10px"
        }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            Attendance
          </div>

          <div>
            <button
              onClick={() => navigate("/teacher-login")}
              style={{
                marginRight: "10px",
                //padding: "16px 40px",
                padding: "clamp(10px, 2vw, 16px) clamp(20px, 5vw, 40px)",
                //fontSize: "18px",
                fontSize: "clamp(14px, 3vw, 18px)",
                borderRadius: "20px",
                background: "transparent",
                color: "white",
                border: "1px solid white"
              }}
            >
              Teacher
            </button>

            <button
              onClick={() => navigate("/login")}
              style={{
                //padding: "16px 40px",
                padding: "clamp(10px, 2vw, 16px) clamp(20px, 5vw, 40px)",
                //fontSize: "18px",
                fontSize: "clamp(14px, 3vw, 18px)",
                borderRadius: "20px",
                background: "white",
                color: "black",
                border: "none"
              }}
            >
              Log In
            </button>
          </div>
        </div>

        {/* Hero */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "-50px"
        }}>

          {/* 标题 */}
          <h1 style={{
            //fontSize: "72px",
            fontSize: "clamp(28px, 6vw, 72px)",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "20px"
          }}>
            Classroom Attendance
          </h1>

          {/* 副标题 */}
          <p style={{
            marginTop: "20px",
            //fontSize: "28px",
            fontSize: "clamp(14px, 2.5vw, 28px)",
            maxWidth: "600px",
            textAlign: "center",
            marginBottom: "40px"
          }}>
            Generate QR codes instantly for students to scan and check in. Manage classroom attendance efficiently and keep every session organized.
          </p>

        </div>
      </div>
    </div>
  );
}