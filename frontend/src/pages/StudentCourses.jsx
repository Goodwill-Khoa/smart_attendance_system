import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";

export default function StudentCourses({ user }) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const BASE_URL = getApiBaseUrl();
  const studentEmail = useMemo(() => user?.email || "", [user]);

  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const fetchCourses = async () => {
    if (!studentEmail) {
      setCourses([]);
      setLoading(false);
      return;
    }

    try {
      const jwt = await getJWT();
      const res = await fetch(`${BASE_URL}/courses?email=${encodeURIComponent(studentEmail)}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) throw new Error("Failed to fetch courses");

      const data = await res.json();
      setCourses(data.courses || []);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Failed to load courses.");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = async (course) => {
    try {
      setMessage("");
      const jwt = await getJWT();
      const res = await fetch(
        `${BASE_URL}/sessions?course=${encodeURIComponent(course.id)}&email=${encodeURIComponent(studentEmail)}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      const data = await res.json();
      if (data.active) {
        navigate("/scan", {
          state: { sessionId: data.sessionId, courseId: course.id, courseName: course.name }
        });
      } else {
        setMessage(`"${course.name}" has not started yet.`);
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to check session.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <BaseLayout
      headerTitle="Student Courses"
      headerActions={[{ label: "Logout", onClick: handleLogout, style: { background: "black" } }]}
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px", fontSize: "clamp(20px, 4vw, 24px)" }}>
        My Courses
      </h2>

      <p style={{ textAlign: "center", color: "#666", marginBottom: "35px", fontSize: "clamp(13px, 1.8vw, 14px)" }}>
        Click on a course to scan attendance if a session is active.
      </p>

      {loading ? (
        <p style={{ textAlign: "center", color: "#666" }}>Loading courses...</p>
      ) : courses.length === 0 ? (
        <p style={{ textAlign: "center", color: "#999", marginTop: "30px" }}>
          No courses assigned yet. Contact your instructor.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {courses.map((course) => (
            <button
              key={course.id}
              onClick={() => handleCourseClick(course)}
              style={{
                padding: "clamp(14px, 3vw, 20px)",
                borderRadius: "18px",
                border: "none",
                cursor: "pointer",
                background: course.active ? "black" : "rgba(0,0,0,0.1)",
                color: course.active ? "white" : "#333",
                transition: "0.2s",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: "clamp(16px, 4vw, 20px)", fontWeight: "bold", marginBottom: "6px", wordBreak: "break-word" }}>
                {course.name}
              </div>
              <div style={{ fontSize: "clamp(12px, 2.5vw, 14px)", opacity: 0.85 }}>
                {course.active ? "Class is active • Click to scan attendance" : "Class has not started yet"}
              </div>
            </button>
          ))}
        </div>
      )}

      {message && (
        <div style={{
          marginTop: "25px",
          padding: "16px",
          borderRadius: "14px",
          background: "rgba(255,0,0,0.08)",
          color: "red",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "clamp(12px, 1.8vw, 14px)",
        }}>
          {message}
        </div>
      )}
    </BaseLayout>
  );
}
