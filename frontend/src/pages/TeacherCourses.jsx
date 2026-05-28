import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { getApiBaseUrl } from "../services/apiBase";

export default function TeacherCourses({ user }) {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [selectedCatalogCourseId, setSelectedCatalogCourseId] = useState("");

  const [showManagePanel, setShowManagePanel] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseType, setNewCourseType] = useState("L");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [rosterFile, setRosterFile] = useState(null);
  const [uploadingRoster, setUploadingRoster] = useState(false);
  const [rosterSummary, setRosterSummary] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [checkingPasswordPolicy, setCheckingPasswordPolicy] = useState(false);

  const BASE_URL = getApiBaseUrl();

  const getJWT = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  };

  const fetchSemesters = async () => {
    try {
      const res = await fetch(`${BASE_URL}/semesters`);
      const data = await res.json();
      const semesterList = data.semesters || [];

      setSemesters(semesterList);
      if (!selectedSemester && semesterList.length > 0) {
        setSelectedSemester(semesterList[semesterList.length - 1]);
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to load semesters.");
    }
  };

  const teacherEmail = useMemo(() => user?.email || "", [user]);

  const fetchCourses = async (semesterToLoad = selectedSemester) => {
    if (!teacherEmail) {
      setCourses([]);
      setSelectedCourseId("");
      setLoading(false);
      return;
    }

    try {
      const jwt = await getJWT();
      const params = new URLSearchParams();
      if (semesterToLoad) params.set("semester", semesterToLoad);
      params.set("teacherEmail", teacherEmail);

      const res = await fetch(`${BASE_URL}/courses/teacher?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      const data = await res.json();
      setCourses(data);

      if (data.length > 0) {
        const stillExists = data.some((course) => course.id === selectedCourseId);
        setSelectedCourseId(stillExists ? selectedCourseId : data[0].id);
      } else {
        setSelectedCourseId("");
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load courses.");
      setLoading(false);
    }
  };

  const fetchCatalogCourses = async (semesterToLoad = selectedSemester) => {
    try {
      const params = new URLSearchParams();
      if (semesterToLoad) params.set("semester", semesterToLoad);
      const res = await fetch(`${BASE_URL}/courses/catalog?${params.toString()}`);
      const data = await res.json();

      setCatalogCourses(data);
      if (data.length > 0) {
        const keep = data.some((course) => course.id === selectedCatalogCourseId);
        setSelectedCatalogCourseId(keep ? selectedCatalogCourseId : data[0].id);
      } else {
        setSelectedCatalogCourseId("");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to load course catalog.");
    }
  };

  const refreshDashboard = async (semesterOverride = selectedSemester) => {
    await fetchSemesters();
    await fetchCatalogCourses(semesterOverride);
    await fetchCourses(semesterOverride);
  };

  const handleAddCourse = async () => {
    setMessage("");

    if (!selectedCatalogCourseId) {
      setMessage("Select a course from catalog.");
      return;
    }

    if (!selectedSemester) {
      setMessage("Please select a semester first.");
      return;
    }

    try {
      setSaving(true);
      const jwt = await getJWT();

      const res = await fetch(`${BASE_URL}/teacher/courses/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          teacher_email: teacherEmail,
          course_id: selectedCatalogCourseId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail || "Failed to add course.");
        return;
      }

      await refreshDashboard(selectedSemester);
      setMessage(data.message || "Course added to your list.");
    } catch (err) {
      console.error(err);
      setMessage("Network error while adding course.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCourse = async () => {
    setMessage("");

    if (!selectedCourseId) {
      setMessage("Select a course to remove.");
      return;
    }

    try {
      const jwt = await getJWT();
      const params = new URLSearchParams({ teacherEmail });
      const res = await fetch(`${BASE_URL}/teacher/courses/${selectedCourseId}/assign?${params.toString()}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.detail || "Failed to remove course.");
        return;
      }

      await fetchCourses(selectedSemester);
      await fetchCatalogCourses(selectedSemester);
      setMessage(data.message || "Course removed from your list.");
    } catch (err) {
      console.error(err);
      setMessage("Network error while removing course.");
    }
  };

  const handleRequestCourse = async () => {
    setMessage("");
    if (!teacherEmail) {
      setMessage("Missing teacher identity. Please re-login.");
      return;
    }
    if (!newCourseName.trim()) {
      setMessage("Course name is required for request.");
      return;
    }

    try {
      const jwt = await getJWT();
      const res = await fetch(`${BASE_URL}/courses/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          teacher_email: teacherEmail,
          name: newCourseName.trim(),
          course_type: newCourseType,
          code: newCourseCode.trim() || null,
          semester: selectedSemester,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail || "Failed to submit request.");
        return;
      }

      setMessage(data.message || "Request sent to DB admin.");
      setNewCourseName("");
      setNewCourseType("L");
      setNewCourseCode("");
    } catch (err) {
      console.error(err);
      setMessage("Network error while requesting course approval.");
    }
  };

  const handleStartSelectedCourse = async () => {
    setMessage("");
    const course = courses.find((item) => item.id === selectedCourseId);

    if (!course) {
      setMessage("Select a course before starting a session.");
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
          course_id: course.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.detail || data.message || "Failed to start session.");
        return;
      }

      navigate("/teacher", {
        state: {
          sessionId: data.sessionId,
          courseId: course.id,
          courseName: course.name,
        },
      });
    } catch (err) {
      console.error(err);
      setMessage("Network error while starting session.");
    }
  };

  const handleUploadRoster = async () => {
    setMessage("");
    setRosterSummary("");

    if (!selectedCourseId) {
      setMessage("Select a course before uploading student registry.");
      return;
    }
    if (!rosterFile) {
      setMessage("Choose a CSV file before uploading.");
      return;
    }

    try {
      setUploadingRoster(true);
      const jwt = await getJWT();
      const formData = new FormData();
      formData.append("rosterFile", rosterFile);

      const res = await fetch(`${BASE_URL}/teacher/courses/${selectedCourseId}/students/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.detail || "Failed to upload student registry.");
        return;
      }

      setRosterSummary(
        `Student registry uploaded: ${data.uploadedCount || 0} valid row(s), ${data.invalidRows || 0} invalid row(s).`
      );
      setRosterFile(null);
    } catch (err) {
      console.error(err);
      setMessage("Network error while uploading student registry.");
    } finally {
      setUploadingRoster(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/home", { replace: true });
  };

  const enforcePasswordPolicy = async () => {
    if (!teacherEmail) return false;

    try {
      setCheckingPasswordPolicy(true);
      const params = new URLSearchParams({ email: teacherEmail });
      const res = await fetch(`${BASE_URL}/lecturers/password-policy?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.mustChangePassword) {
        navigate("/teacher-password", { replace: true });
        return true;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingPasswordPolicy(false);
    }

    return false;
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  useEffect(() => {
    if (!selectedSemester) return;
    (async () => {
      const redirected = await enforcePasswordPolicy();
      if (redirected) return;

      setLoading(true);
      fetchCatalogCourses(selectedSemester);
      fetchCourses(selectedSemester);
    })();
  }, [selectedSemester, teacherEmail]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "clamp(20px,4vw,40px) 5vw",
            color: "white",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "clamp(18px,4vw,24px)", fontWeight: "bold" }}>
            Teacher Panel
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => navigate("/teacher-password")}
              style={{
                padding: "12px 18px",
                borderRadius: "20px",
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                cursor: "pointer",
                fontSize: "15px",
              }}
            >
              Change Password
            </button>

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
        </div>

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
              maxWidth: "700px",
              padding: "40px",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Teacher Dashboard</h2>
            {checkingPasswordPolicy && (
              <p style={{ textAlign: "center", color: "#555", marginTop: 0 }}>
                Checking password policy...
              </p>
            )}
            <p style={{ textAlign: "center", color: "#666", marginBottom: "20px" }}>
              Choose semester and course from dropdown.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ccc", color: "#111", fontWeight: 600 }}
              >
                {semesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowManagePanel((prev) => !prev)}
                style={{
                  borderRadius: "10px",
                  border: "1px solid #222",
                  background: "#fff",
                  color: "#222",
                  padding: "0 14px",
                  cursor: "pointer",
                }}
              >
                {showManagePanel ? "Hide Manage" : "Manage Courses"}
              </button>
            </div>

            {showManagePanel && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 1fr auto auto",
                  gap: "10px",
                  marginBottom: "18px",
                }}
              >
                <input
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Request course name"
                  style={{ padding: "10px", borderRadius: "10px", border: "1px solid #ccc" }}
                />
                <select
                  value={newCourseType}
                  onChange={(e) => setNewCourseType(e.target.value)}
                  style={{ padding: "10px", borderRadius: "10px", border: "1px solid #ccc", color: "#111", fontWeight: 600 }}
                >
                  <option value="L">L</option>
                  <option value="Pr">Pr</option>
                  <option value="Lab">Lab</option>
                  <option value="Lab I">Lab I</option>
                </select>
                <input
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  placeholder="Optional request code"
                  style={{ padding: "10px", borderRadius: "10px", border: "1px solid #ccc" }}
                />
                <button
                  onClick={handleAddCourse}
                  disabled={saving}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: "#1f6f3f",
                    color: "white",
                    padding: "0 14px",
                    cursor: "pointer",
                  }}
                >
                  Add From DB
                </button>
                <button
                  onClick={handleRemoveCourse}
                  style={{
                    border: "1px solid #a00",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    background: "#fff",
                    color: "#a00",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
                <select
                  value={selectedCatalogCourseId}
                  onChange={(e) => setSelectedCatalogCourseId(e.target.value)}
                  style={{ padding: "10px", borderRadius: "10px", border: "1px solid #ccc", color: "#111", fontWeight: 600, gridColumn: "1 / span 3" }}
                >
                  <option value="">Select from DB catalog</option>
                  {catalogCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {`${course.name}, ${course.courseType || "L"}, ${course.code}`}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRequestCourse}
                  style={{
                    border: "1px solid #10316b",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    background: "#fff",
                    color: "#10316b",
                    cursor: "pointer",
                    gridColumn: "4 / span 2",
                  }}
                >
                  Request DB Approval
                </button>
              </div>
            )}

            {loading ? (
              <p style={{ textAlign: "center" }}>Loading courses...</p>
            ) : (
              <>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #ccc",
                    background: "#fff",
                    color: "#111",
                    fontWeight: 600,
                  }}
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {`${course.name}, ${course.courseType || "L"}, ${course.code}`}
                    </option>
                  ))}
                </select>

                {selectedCourse ? (
                  <div
                    style={{
                      border: "1px solid #d8d8d8",
                      borderRadius: "12px",
                      padding: "14px",
                      background: "#fafafa",
                      marginTop: "14px",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "6px" }}>{selectedCourse.name}</div>
                    <div style={{ fontSize: "14px", color: "#555", marginBottom: "10px" }}>
                      {selectedCourse.courseType || "L"}, {selectedCourse.code}
                    </div>
                    <button
                      onClick={handleStartSelectedCourse}
                      style={{
                        border: "none",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        background: "black",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      Start Session
                    </button>

                    <div style={{ marginTop: "14px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                      <div style={{ fontSize: "13px", color: "#374151", marginBottom: "8px", fontWeight: 600 }}>
                        Upload registered students (CSV)
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          key={selectedCourseId}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
                          style={{ maxWidth: "330px" }}
                        />
                        <button
                          onClick={handleUploadRoster}
                          disabled={uploadingRoster}
                          style={{
                            border: "1px solid #1f6f3f",
                            borderRadius: "10px",
                            padding: "8px 12px",
                            background: "white",
                            color: "#1f6f3f",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {uploadingRoster ? "Uploading..." : "Upload Student List"}
                        </button>
                      </div>
                      {rosterSummary && (
                        <div style={{ marginTop: "8px", color: "#14532d", fontSize: "13px" }}>{rosterSummary}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "14px", color: "#666", marginTop: "12px" }}>
                    Select a course to reveal course details and start session.
                  </div>
                )}
              </>
            )}

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

