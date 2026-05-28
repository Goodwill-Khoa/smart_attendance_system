import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveButtonStyle } from "../components/BaseLayout";

export default function StudentFlow({ user }) {
  const navigate = useNavigate();

  const handleBackToHome = async () => {
    await supabase.auth.signOut();
    navigate("/home", { replace: true });
  };

  const headerActions = [
    {
      label: "Back to Home",
      onClick: handleBackToHome,
      style: { background: "black" }
    }
  ];

  return (
    <BaseLayout
      headerTitle="Attendance Process"
      headerActions={headerActions}
      maxWidth="700px"
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px", fontSize: "clamp(20px, 4vw, 24px)" }}>
        Student Flow: 3-Second Check-In
      </h2>

      <p style={{ textAlign: "center", color: "#4a5878", marginTop: 0, marginBottom: "25px", fontSize: "clamp(13px, 1.8vw, 15px)" }}>
        Scan projected QR • ELTE Microsoft SSO • No app install
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
        <button
          onClick={() => navigate("/courses")}
          style={{
            ...responsiveButtonStyle("#10244f", "white"),
            width: "100%"
          }}
        >
          Open Student Courses
        </button>
        <button
          onClick={handleBackToHome}
          style={{
            ...responsiveButtonStyle("white", "#10244f"),
            border: "1px solid #10244f",
            width: "100%"
          }}
        >
          Back to Home
        </button>
      </div>

      {!user && (
        <div style={{
          marginTop: "15px",
          padding: "14px",
          borderRadius: "12px",
          background: "rgba(122, 29, 29, 0.1)",
          color: "#7a1d1d",
          fontSize: "clamp(12px, 1.8vw, 14px)",
          textAlign: "center"
        }}>
          You are not signed in. Login is required before scanning attendance.
        </div>
      )}
    </BaseLayout>
  );
}

function StepCard({ index, title, text }) {
  return (
    <div style={{
      border: "1px solid #d4ddf4",
      borderRadius: "12px",
      padding: "clamp(12px, 2vw, 16px)",
      background: "#f8faff",
    }}>
      <div style={{
        fontWeight: "bold",
        marginBottom: "6px",
        fontSize: "clamp(14px, 2vw, 16px)"
      }}>
        {index}. {title}
      </div>
      <div style={{
        color: "#566281",
        fontSize: "clamp(12px, 1.8vw, 14px)"
      }}>
        {text}
      </div>
    </div>
  );
}
