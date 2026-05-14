import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function TeacherCourses({ user }) {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // mock / real
  const BASE_URL = "mock";
  //const BASE_URL = "http://127.0.0.1:8000";

  // 获取 JWT
  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  // 获取教师课程
  const fetchCourses = async () => {
    try {
      // ===== MOCK =====
      if (BASE_URL === "mock") {
        setCourses([
          {
            id: 1,
            name: "English",
            active: false,
          },
          {
            id: 2,
            name: "Mathematics",
            active: false,
          },
          {
            id: 3,
            name: "Physics",
            active: false,
          },
        ]);

        setLoading(false);
        return;
      }

      // ===== REAL =====
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/courses/teacher`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      const data = await res.json();

      setCourses(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load courses.");
      setLoading(false);
    }
  };

  // 开始课程
  const handleStartCourse = async (course) => {
    setMessage("");

    // ===== MOCK =====
    if (BASE_URL === "mock") {
      navigate("/teacher", {
        state: {
          sessionId: "mock-session-" + Date.now(),
          courseId: course.id,
          courseName: course.name,
        },
      });

      return;
    }

    // ===== REAL =====
    try {
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          course_id: course.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        navigate("/teacher", {
          state: {
            sessionId: data.sessionId,
            courseId: course.id,
            courseName: course.name,
          },
        });
      } else {
        setMessage(data.message || "Failed to start course.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Network error.");
    }
  };

  // 登出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    fetchCourses();
  }, []);

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
            padding: "clamp(20px,4vw,40px) 5vw",
            color: "white",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "clamp(18px,4vw,24px)",
              fontWeight: "bold",
            }}
          >
            Teacher Panel
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: "12px 24px",
              borderRadius: "20px",
              border: "none",
              background: "black",
              color: "white",
              cursor: "pointer",
              fontSize: "16px",
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
            minHeight: "80vh",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "40px",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                marginBottom: "10px",
              }}
            >
              Select a Course
            </h2>

            <p
              style={{
                textAlign: "center",
                color: "#666",
                marginBottom: "35px",
              }}
            >
              Start attendance session for a course
            </p>

            {loading ? (
              <p style={{ textAlign: "center" }}>
                Loading courses...
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => handleStartCourse(course)}
                    style={{
                      padding: "20px",
                      borderRadius: "18px",
                      border: "none",
                      cursor: "pointer",
                      background: "black",
                      color: "white",
                      transition: "0.2s",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginBottom: "6px",
                      }}
                    >
                      {course.name}
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        opacity: 0.85,
                      }}
                    >
                      Click to start attendance session
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                style={{
                  marginTop: "25px",
                  padding: "16px",
                  borderRadius: "14px",
                  background: "rgba(255,0,0,0.08)",
                  color: "red",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}