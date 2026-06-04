import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle, mobileGridStyle } from "../components/BaseLayout";
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
        headers: { Authorization: `Bearer ${jwt}` },
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
        headers: { Authorization: `Bearer ${jwt}` },
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
        body: JSON.stringify({ course_id: course.id }),
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
        headers: { Authorization: `Bearer ${jwt}` },
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

  const headerActions = [
    {
      label: "Change Password",
      onClick: () => navigate("/teacher-password"),
      style: { background: "white", color: "#111827", border: "1px solid #d1d5db" }
    },
    {
      label: "Logout",
      onClick: handleLogout,
      style: { background: "black" }
    }
  ];

  return (
    <BaseLayout
      headerTitle="Teacher Dashboard"
      headerActions={headerActions}
      maxWidth="700px"
    >
      <h2 style={{ textAlign: "center", marginBottom: "8px", fontSize: "clamp(20px, 4vw, 24px)" }}>
        Manage Your Courses
      </h2>

      {checkingPasswordPolicy && (
        <p style={{ textAlign: "center", color: "#555", marginTop: 0, fontSize: "clamp(13px, 1.8vw, 15px)" }}>
          Checking password policy...
        </p>
      )}

      <p style={{ textAlign: "center", color: "#666", marginBottom: "20px", fontSize: "clamp(13px, 1.8vw, 14px)" }}>
        Choose semester and course from dropdown.
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          style={{
            ...responsiveInputStyle,
            flex: 1,
            minWidth: "140px",
            fontWeight: 600
          }}
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
            ...responsiveButtonStyle("white", "#222"),
            border: "1px solid #222",
            padding: "clamp(8px, 2vw, 10px) clamp(12px, 2vw, 16px)",
            whiteSpace: "nowrap"
          }}
        >
          {showManagePanel ? "Hide" : "Manage"}
        </button>
      </div>

      {showManagePanel && (
        <div style={{
          ...mobileGridStyle("140px"),
          marginBottom: "18px",
          padding: "14px",
          background: "#f9fafb",
          borderRadius: "12px"
        }}>
          <input
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            placeholder="Request course name"
            style={{ ...responsiveInputStyle, gridColumn: "1 / -1" }}
          />
          <select
            value={newCourseType}
            onChange={(e) => setNewCourseType(e.target.value)}
            style={{ ...responsiveInputStyle, fontWeight: 600 }}
          >
            <option value="L">L</option>
            <option value="Pr">Pr</option>
            <option value="Lab">Lab</option>
            <option value="Lab I">Lab I</option>
          </select>
          <input
            value={newCourseCode}
            onChange={(e) => setNewCourseCode(e.target.value)}
            placeholder="Optional code"
            style={{ ...responsiveInputStyle }}
          />
          <button
            onClick={handleAddCourse}
            disabled={saving}
            style={{
              ...responsiveButtonStyle("#1f6f3f", "white"),
              gridColumn: "1 / -1",
              border: "none"
            }}
          >
            Add From DB
          </button>
          <button
            onClick={handleRemoveCourse}
            style={{
              ...responsiveButtonStyle("white", "#a00"),
              border: "1px solid #a00",
              gridColumn: "1 / -1"
            }}
          >
            Remove
          </button>
          <select
            value={selectedCatalogCourseId}
            onChange={(e) => setSelectedCatalogCourseId(e.target.value)}
            style={{ ...responsiveInputStyle, gridColumn: "1 / -1", fontWeight: 600 }}
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
              ...responsiveButtonStyle("white", "#10316b"),
              border: "1px solid #10316b",
              gridColumn: "1 / -1"
            }}
          >
            Request DB Approval
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#666" }}>Loading courses...</p>
      ) : (
        <>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              ...responsiveInputStyle,
              width: "100%",
              fontWeight: 600
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
            <div style={{
              border: "1px solid #d8d8d8",
              borderRadius: "12px",
              padding: "14px",
              background: "#fafafa",
              marginTop: "14px"
            }}>
              <div style={{ fontWeight: "bold", marginBottom: "6px", fontSize: "clamp(16px, 2.5vw, 18px)" }}>
                {selectedCourse.name}
              </div>
              <div style={{ fontSize: "clamp(12px, 1.8vw, 14px)", color: "#555", marginBottom: "12px" }}>
                {selectedCourse.courseType || "L"}, {selectedCourse.code}
              </div>
              <button
                onClick={handleStartSelectedCourse}
                style={{ ...responsiveButtonStyle("black", "white"), width: "100%" }}
              >
                Start Session
              </button>

              <div style={{ marginTop: "14px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                <div style={{ fontSize: "clamp(12px, 1.8vw, 13px)", color: "#374151", marginBottom: "10px", fontWeight: 600 }}>
                  📋 Upload Registered Students (CSV or XLSX)
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
                  <input
                    key={selectedCourseId}
                    type="file"
                    accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
                    style={{ maxWidth: "100%", fontSize: "clamp(12px, 1.8vw, 14px)" }}
                  />
                  <button
                    onClick={handleUploadRoster}
                    disabled={uploadingRoster}
                    style={{
                      ...responsiveButtonStyle("white", "#1f6f3f"),
                      border: "1px solid #1f6f3f",
                      padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)",
                      whiteSpace: "nowrap",
                      fontWeight: 600
                    }}
                  >
                    {uploadingRoster ? "Uploading..." : "Upload"}
                  </button>
                </div>
                {rosterSummary && (
                  <div style={{ marginTop: "8px", color: "#14532d", fontSize: "clamp(12px, 1.8vw, 13px)" }}>
                    ✅ {rosterSummary}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "clamp(13px, 1.8vw, 14px)", color: "#666", marginTop: "12px", textAlign: "center" }}>
              Select a course to reveal details and start session.
            </div>
          )}
        </>
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
          fontSize: "clamp(12px, 1.8vw, 14px)"
        }}>
          {message}
        </div>
      )}
    </BaseLayout>
  );
}
