import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const buttonStyle = (bg, color, border) => ({
    padding: "clamp(10px, 2vw, 16px) clamp(20px, 5vw, 40px)",
    fontSize: "clamp(14px, 3vw, 18px)",
    borderRadius: "20px",
    background: bg,
    color: color,
    border: border || "none",
    cursor: "pointer",
    transition: "0.2s",
  });

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      backgroundImage: "url('/ELTELogo.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    }}>
      <div style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        background: "linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.4))",
        pointerEvents: "none"
      }} />

      <div style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        color: "white"
      }}>
        {/* Header Navigation */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "30px 5vw",
          marginTop: "10px",
          flexWrap: "wrap",
          gap: "15px"
        }}>
          <div style={{ fontSize: "clamp(20px, 4vw, 24px)", fontWeight: "bold" }}>
            Smart Attendance
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/admin-login")}
              style={{ ...buttonStyle("#131313", "white", "1px solid #131313") }}
            >
              Admin
            </button>

            <button
              onClick={() => navigate("/teacher-login")}
              style={{ ...buttonStyle("transparent", "white", "1px solid white") }}
            >
              Teacher
            </button>

            <button
              onClick={() => navigate("/login")}
              style={{ ...buttonStyle("white", "black") }}
            >
              Student
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "-50px",
          padding: "20px"
        }}>
          <h1 style={{
            fontSize: "clamp(28px, 6vw, 72px)",
            fontWeight: "bold",
            textAlign: "center",
            margin: 0,
            position: "absolute",
            top: "12%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%"
          }}>
            Smart Multi-Modal Attendance
          </h1>

          <p style={{
            margin: 0,
            fontSize: "clamp(14px, 2.5vw, 28px)",
            maxWidth: "600px",
            textAlign: "center",
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%"
          }}>
            Generate QR codes instantly for students to scan and check in. Manage classroom attendance efficiently and keep every session organized.
          </p>
        </div>
      </div>
    </div>
  );
}
