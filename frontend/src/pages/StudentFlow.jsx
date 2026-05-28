import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function StudentFlow({ user }) {
  const navigate = useNavigate();

  const handleBackToHome = async () => {
    await supabase.auth.signOut();
    navigate("/home", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef3ff 0%, #dde8ff 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          background: "white",
          borderRadius: "22px",
          padding: "26px",
          boxShadow: "0 20px 45px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "10px" }}>
          Student Flow: 3-Second Check-In
        </h1>
        <p style={{ color: "#4a5878", marginTop: 0 }}>
          Scan projected QR • ELTE Microsoft SSO • No app install
        </p>

        <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
          <StepCard
            index="1"
            title="Scan projected QR"
            text="Open native phone camera and scan the live QR shown by the lecturer."
          />
          <StepCard
            index="2"
            title="Authenticate with ELTE Microsoft SSO"
            text="Sign in using institutional account. No separate mobile app is needed."
          />
          <StepCard
            index="3"
            title="Checked in within seconds"
            text="Attendance service validates token freshness and records attendance."
          />
          <StepCard
            index="Anti-Cheat"
            title="One Device, One Session"
            text="A local device token is stored for first check-in; duplicate hardware footprints are rejected per session."
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "22px", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/courses")}
            style={{
              border: "none",
              borderRadius: "12px",
              padding: "12px 18px",
              background: "#10244f",
              color: "white",
              cursor: "pointer",
            }}
          >
            Open Student Courses
          </button>
          <button
            onClick={handleBackToHome}
            style={{
              border: "1px solid #10244f",
              borderRadius: "12px",
              padding: "12px 18px",
              background: "white",
              color: "#10244f",
              cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>

        {!user && (
          <p style={{ marginTop: "12px", color: "#7a1d1d" }}>
            You are not signed in. Login is required before scanning attendance.
          </p>
        )}
      </div>
    </div>
  );
}

function StepCard({ index, title, text }) {
  return (
    <div
      style={{
        border: "1px solid #d4ddf4",
        borderRadius: "12px",
        padding: "14px",
        background: "#f8faff",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
        {index}. {title}
      </div>
      <div style={{ color: "#566281" }}>{text}</div>
    </div>
  );
}
