import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../services/apiBase";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveInputStyle, responsiveButtonStyle, mobileGridStyle } from "../components/BaseLayout";

export default function AdminDashboard() {
  const BASE_URL = getApiBaseUrl();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [courseRequests, setCourseRequests] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState("");
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [lecturerTitle, setLecturerTitle] = useState("Lecturer");
  const [lecturerFullName, setLecturerFullName] = useState("");
  const [lecturerEmail, setLecturerEmail] = useState("");
  const [newLecturerIsAdmin, setNewLecturerIsAdmin] = useState(false);
  const [emergencyComment, setEmergencyComment] = useState("");
  const [latestTempPassword, setLatestTempPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [adminIdentity, setAdminIdentity] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const canManageLecturers = Boolean(overview);

  const selectedLecturer = lecturers.find((item) => item.id === selectedLecturerId) || null;

  const getAdminHeaders = async (includeJson = false) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (includeJson) headers["Content-Type"] = "application/json";
    return headers;
  };

  const verifyAdminSession = async () => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/auth/check`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        navigate("/admin-login", { replace: true });
        return false;
      }
      setAdminIdentity(data);
      return true;
    } catch (err) {
      navigate("/admin-login", { replace: true });
      return false;
    }
  };

  const loadDashboard = async () => {
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const headers = await getAdminHeaders();
      const [overviewRes, activeRes, requestsRes, lecturersRes, passwordRequestsRes] = await Promise.all([
        fetch(`${BASE_URL}/admin/overview`, { headers }),
        fetch(`${BASE_URL}/admin/sessions/active`, { headers }),
        fetch(`${BASE_URL}/admin/course-requests`, { headers }),
        fetch(`${BASE_URL}/admin/lecturers`, { headers }),
        fetch(`${BASE_URL}/admin/password-requests`, { headers }),
      ]);

      if (!overviewRes.ok) {
        const data = await overviewRes.json();
        setError(data.detail || "Failed to load admin overview.");
        return;
      }

      const overviewData = await overviewRes.json();
      const activeData = activeRes.ok ? await activeRes.json() : [];
      const requestsData = requestsRes.ok ? await requestsRes.json() : [];
      const lecturersData = lecturersRes.ok ? await lecturersRes.json() : [];
      const passwordRequestsData = passwordRequestsRes.ok ? await passwordRequestsRes.json() : [];

      setOverview(overviewData);
      setActiveSessions(activeData);
      setCourseRequests(Array.isArray(requestsData) ? requestsData : []);
      const nextLecturers = Array.isArray(lecturersData) ? lecturersData : [];
      setLecturers(nextLecturers);
      setSelectedLecturerId((current) => (current && nextLecturers.some((item) => item.id === current) ? current : nextLecturers[0]?.id || ""));
      setPasswordRequests(Array.isArray(passwordRequestsData) ? passwordRequestsData : []);
    } catch (err) {
      setError("Network error loading dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId) => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/course-requests/${requestId}/approve`, { method: "POST", headers });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to approve request.");
        return;
      }
      await loadDashboard();
    } catch (err) {
      setError("Network error approving request.");
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/course-requests/${requestId}`, { method: "DELETE", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to reject request.");
        return;
      }
      setSuccessMessage(data.message || "Course request rejected.");
      await loadDashboard();
    } catch (err) {
      setError("Network error rejecting request.");
    }
  };

  const handleEndAllSessions = async () => {
    setError("");
    setSuccessMessage("");

    const comment = emergencyComment.trim();
    if (!comment) {
      setError("Please add an emergency comment before ending all sessions.");
      return;
    }

    const confirmed = window.confirm("End all active sessions?");
    if (!confirmed) return;

    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch(`${BASE_URL}/admin/sessions/end-all`, { method: "POST", headers, body: JSON.stringify({ comment }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to end all sessions.");
        return;
      }
      setSuccessMessage(data.message || "All sessions were ended.");
      setEmergencyComment("");
      await loadDashboard();
    } catch (err) {
      setError("Network error ending sessions.");
    }
  };

  const handleAddLecturer = async () => {
    setError("");
    setSuccessMessage("");
    setLatestTempPassword("");

    if (!lecturerEmail.trim()) {
      setError("Lecturer email is required.");
      return;
    }
    if (!lecturerFullName.trim()) {
      setError("Lecturer full name is required.");
      return;
    }

    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch(`${BASE_URL}/admin/lecturers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: lecturerTitle.trim() || "Lecturer",
          full_name: lecturerFullName.trim(),
          email: lecturerEmail.trim().toLowerCase(),
          is_admin: newLecturerIsAdmin,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to add lecturer.");
        return;
      }

      setSuccessMessage(data.message || "Lecturer saved.");
      if (data.tempPassword) setLatestTempPassword(data.tempPassword);
      setLecturerTitle("Lecturer");
      setLecturerFullName("");
      setLecturerEmail("");
      setNewLecturerIsAdmin(false);
      await loadDashboard();
    } catch (err) {
      setError("Network error adding lecturer.");
    }
  };

  const handleRemoveSelectedLecturer = async () => {
    if (!selectedLecturer) {
      setError("Select a lecturer to remove.");
      return;
    }

    const confirmed = window.confirm(`Remove ${selectedLecturer.fullName || selectedLecturer.name}?`);
    if (!confirmed) return;

    setError("");
    setSuccessMessage("");

    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/lecturers/${selectedLecturer.id}`, { method: "DELETE", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to remove lecturer.");
        return;
      }

      setSuccessMessage(data.message || "Lecturer removed.");
      await loadDashboard();
    } catch (err) {
      setError("Network error removing lecturer.");
    }
  };

  const handleSetLecturerAdminAccess = async (isAdmin) => {
    if (!selectedLecturer) {
      setError("Select a lecturer first.");
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch(`${BASE_URL}/admin/lecturers/${selectedLecturer.id}/admin-access`, {
        method: "POST",
        headers,
        body: JSON.stringify({ is_admin: isAdmin }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to update admin access.");
        return;
      }

      setSuccessMessage(data.message || "Admin access updated.");
      await loadDashboard();
    } catch (err) {
      setError("Network error updating admin access.");
    }
  };

  const handleIssueTempPassword = async (requestId) => {
    setError("");
    setSuccessMessage("");
    setLatestTempPassword("");

    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/password-requests/${requestId}/issue-temp-password`, { method: "POST", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to issue temporary password.");
        return;
      }

      setSuccessMessage(data.message || "Temporary password issued.");
      if (data.tempPassword) setLatestTempPassword(data.tempPassword);
      await loadDashboard();
    } catch (err) {
      setError("Network error issuing password.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    (async () => {
      const allowed = await verifyAdminSession();
      if (allowed) await loadDashboard();
      setAuthChecking(false);
    })();
  }, []);

  if (authChecking) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f4ef", color: "#374151", fontWeight: 600 }}>Checking admin access...</div>;
  }

  const headerActions = [
    { label: "Home", onClick: () => navigate("/home"), style: { background: "white", color: "#1f2937", border: "1px solid #cbd5e1" } },
    { label: "Logout", onClick: handleLogout, style: { background: "#111827" } }
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f4f4ef 0%, #e9efe9 100%)", overflowX: "hidden" }}>
      <div style={{ position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "clamp(16px, 3vw, 30px) 5vw", color: "white", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: "bold" }}>Super User Panel</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {headerActions.map((action, i) => (
              <button key={i} onClick={action.onClick} style={{ ...action.style, padding: "clamp(8px, 1.5vw, 12px) clamp(14px, 2.5vw, 20px)", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "clamp(12px, 2vw, 14px)", border: action.style.border || "none" }}>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "clamp(12px, 3vw, 20px)" }}>
          <div style={{ width: "100%", maxWidth: "900px", background: "white", borderRadius: "16px", padding: "clamp(16px, 4vw, 24px)", boxShadow: "0 20px 45px rgba(0,0,0,0.08)", overflowX: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h1 style={{ marginTop: 0, marginBottom: "8px", fontSize: "clamp(22px, 4vw, 28px)" }}>Dashboard</h1>
                <p style={{ color: "#666", marginTop: 0, fontSize: "clamp(13px, 2vw, 14px)" }}>Backend monitoring & lecturer management</p>
                {adminIdentity?.email && <div style={{ color: "#4b5563", fontSize: "clamp(12px, 1.8vw, 13px)" }}>Signed in as {adminIdentity.email}</div>}
              </div>
              <button onClick={loadDashboard} disabled={loading} style={{ ...responsiveButtonStyle("#1f2a37", "white"), whiteSpace: "nowrap", fontWeight: 600 }}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {error && <div style={{ background: "#ffe9e9", color: "#8c1111", borderRadius: "10px", padding: "12px", marginBottom: "14px", fontSize: "clamp(12px, 1.8vw, 14px)" }}>❌ {error}</div>}
            {successMessage && <div style={{ background: "#e7f8ea", color: "#14532d", borderRadius: "10px", padding: "12px", marginBottom: "14px", fontSize: "clamp(12px, 1.8vw, 14px)" }}>✅ {successMessage}</div>}
            {latestTempPassword && <div style={{ background: "#fff8db", color: "#7a4e00", borderRadius: "10px", padding: "12px", marginBottom: "14px", border: "1px solid #f0cf79", fontSize: "clamp(12px, 1.8vw, 14px)" }}>Temp Password: <b>{latestTempPassword}</b></div>}

            {overview && (
              <div style={{ ...mobileGridStyle("120px"), marginBottom: "20px", gap: "12px" }}>
                <StatCard title="Users" value={overview.users} />
                <StatCard title="Courses" value={overview.courses} />
                <StatCard title="Active" value={overview.activeSessions} />
                <StatCard title="Sessions" value={overview.totalSessions} />
                <StatCard title="Attendance" value={overview.attendanceLogs} />
              </div>
            )}

            {canManageLecturers && (
              <>
                <h3 style={{ marginBottom: "12px", fontSize: "clamp(16px, 3vw, 18px)" }}>Lecturers</h3>
                <div style={{ border: "1px solid #d8dee6", borderRadius: "12px", background: "#f8fbff", padding: "14px", marginBottom: "16px" }}>
                  <div style={{ ...mobileGridStyle("120px"), gap: "10px", marginBottom: "12px" }}>
                    <input value={lecturerTitle} onChange={(e) => setLecturerTitle(e.target.value)} placeholder="Title" style={{ ...responsiveInputStyle }} />
                    <input value={lecturerFullName} onChange={(e) => setLecturerFullName(e.target.value)} placeholder="Full name" style={{ ...responsiveInputStyle }} />
                    <input type="email" value={lecturerEmail} onChange={(e) => setLecturerEmail(e.target.value)} placeholder="Email" style={{ ...responsiveInputStyle }} />
                    <button onClick={handleAddLecturer} style={{ ...responsiveButtonStyle("#1d4ed8", "white"), border: "none", whiteSpace: "nowrap" }}>Add Lecturer</button>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "clamp(12px, 1.8vw, 14px)", marginBottom: "14px" }}>
                    <input type="checkbox" checked={newLecturerIsAdmin} onChange={(e) => setNewLecturerIsAdmin(e.target.checked)} />
                    Grant admin access
                  </label>

                  {lecturers.length === 0 ? (
                    <p style={{ margin: 0, color: "#555", fontSize: "clamp(12px, 1.8vw, 14px)" }}>No lecturers yet.</p>
                  ) : (
                    <>
                      <select value={selectedLecturerId} onChange={(e) => setSelectedLecturerId(e.target.value)} style={{ ...responsiveInputStyle, width: "100%", marginBottom: "12px" }}>
                        {lecturers.map((item) => (
                          <option key={item.id} value={item.id}>{(item.fullName || item.name) + " - " + item.email}</option>
                        ))}
                      </select>

                      {selectedLecturer && (
                        <div style={{ border: "1px solid #dbe4ee", borderRadius: "10px", padding: "12px", background: "white" }}>
                          <div style={{ fontWeight: 700, color: "#1f2937", fontSize: "clamp(13px, 2vw, 15px)", marginBottom: "6px" }}>{selectedLecturer.fullName || selectedLecturer.name}</div>
                          <div style={{ color: "#4b5563", fontSize: "clamp(12px, 1.8vw, 13px)", marginBottom: "4px" }}>{selectedLecturer.title || "Lecturer"}</div>
                          <div style={{ color: "#4b5563", fontSize: "clamp(12px, 1.8vw, 13px)" }}>{selectedLecturer.email}</div>
                          <div style={{ color: "#4b5563", fontSize: "clamp(11px, 1.8vw, 12px)", marginTop: "8px" }}>Admin: {selectedLecturer.isAdmin ? "✅ Enabled" : "❌ Disabled"}</div>

                          <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                            <button onClick={() => handleSetLecturerAdminAccess(!selectedLecturer.isAdmin)} style={{ ...responsiveButtonStyle(selectedLecturer.isAdmin ? "#475569" : "#1d4ed8", "white"), border: "none", whiteSpace: "nowrap", fontSize: "clamp(11px, 1.8vw, 13px)", padding: "clamp(6px, 1.5vw, 8px) clamp(8px, 1.5vw, 12px)" }}>
                              {selectedLecturer.isAdmin ? "Remove Admin" : "Make Admin"}
                            </button>
                            <button onClick={handleRemoveSelectedLecturer} style={{ ...responsiveButtonStyle("#b91c1c", "white"), border: "none", whiteSpace: "nowrap", fontSize: "clamp(11px, 1.8vw, 13px)", padding: "clamp(6px, 1.5vw, 8px) clamp(8px, 1.5vw, 12px)" }}>Remove</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <h3 style={{ marginBottom: "12px", fontSize: "clamp(16px, 3vw, 18px)" }}>Password Requests</h3>
                {passwordRequests.length === 0 ? (
                  <p style={{ color: "#555", marginTop: 0, fontSize: "clamp(12px, 1.8vw, 14px)" }}>No requests.</p>
                ) : (
                  <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
                    {passwordRequests.map((item) => (
                      <div key={item.id} style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "12px", background: "#fff" }}>
                        <div style={{ fontWeight: 700, fontSize: "clamp(13px, 2vw, 14px)" }}>{item.lecturerName || "Lecturer"}</div>
                        <div style={{ color: "#4b5563", fontSize: "clamp(12px, 1.8vw, 13px)" }}>{item.lecturerEmail}</div>
                        {item.status === "PENDING" && <button onClick={() => handleIssueTempPassword(item.id)} style={{ ...responsiveButtonStyle("#1f6f3f", "white"), marginTop: "8px", border: "none", fontSize: "clamp(11px, 1.8vw, 13px)", padding: "clamp(6px, 1.5vw, 8px) clamp(8px, 1.5vw, 12px)" }}>Issue Temp Password</button>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <h3 style={{ marginBottom: "12px", marginTop: "18px", fontSize: "clamp(16px, 3vw, 18px)" }}>Active Sessions</h3>
            {canManageLecturers && (
              <div style={{ border: "1px solid #f3b2b2", borderRadius: "12px", background: "#fff3f3", padding: "12px", marginBottom: "14px" }}>
                <div style={{ fontWeight: 700, color: "#9f1239", marginBottom: "8px", fontSize: "clamp(13px, 2vw, 15px)" }}>🚨 Emergency Protocol</div>
                <textarea value={emergencyComment} onChange={(e) => setEmergencyComment(e.target.value)} placeholder="Emergency message for all sessions" rows={2} style={{ width: "100%", border: "1px solid #d4d4d8", borderRadius: "8px", padding: "10px", marginBottom: "10px", fontSize: "clamp(12px, 1.8vw, 14px)", fontFamily: "monospace", resize: "vertical" }} />
                <button onClick={handleEndAllSessions} style={{ ...responsiveButtonStyle("#b91c1c", "white"), width: "100%", border: "none", fontWeight: 700 }}>End All Sessions</button>
              </div>
            )}

            {activeSessions.length === 0 ? (
              <p style={{ color: "#555", fontSize: "clamp(12px, 1.8vw, 14px)" }}>No active sessions.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
                {activeSessions.map((item) => (
                  <div key={item.sessionId} style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "12px", background: "#fafafa" }}>
                    <div style={{ fontWeight: "bold", fontSize: "clamp(13px, 2vw, 14px)" }}>{item.courseName}</div>
                    <div style={{ color: "#666", fontSize: "clamp(12px, 1.8vw, 13px)" }}>{item.courseCode} • {item.semester}</div>
                  </div>
                ))}
              </div>
            )}

            {canManageLecturers && (
              <>
                <h3 style={{ marginTop: "18px", marginBottom: "12px", fontSize: "clamp(16px, 3vw, 18px)" }}>Course Requests</h3>
                {courseRequests.length === 0 ? (
                  <p style={{ color: "#555", fontSize: "clamp(12px, 1.8vw, 14px)" }}>No pending requests.</p>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {courseRequests.map((item) => (
                      <div key={item.id} style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "12px", background: "#fafafa" }}>
                        <div style={{ fontWeight: "bold", fontSize: "clamp(13px, 2vw, 14px)" }}>{item.name} ({item.courseType})</div>
                        <div style={{ color: "#666", fontSize: "clamp(12px, 1.8vw, 13px)", marginBottom: "8px" }}>{item.code || "No code"} • {item.semester}</div>
                        <div style={{ color: "#666", fontSize: "clamp(11px, 1.8vw, 12px)", marginBottom: "8px" }}>By: {item.teacherEmail}</div>
                        {item.status === "PENDING" && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button onClick={() => approveRequest(item.id)} style={{ ...responsiveButtonStyle("#1f6f3f", "white"), border: "none", fontSize: "clamp(11px, 1.8vw, 13px)", padding: "clamp(6px, 1.5vw, 8px) clamp(8px, 1.5vw, 12px)" }}>Approve</button>
                            <button onClick={() => rejectRequest(item.id)} style={{ ...responsiveButtonStyle("#b91c1c", "white"), border: "none", fontSize: "clamp(11px, 1.8vw, 13px)", padding: "clamp(6px, 1.5vw, 8px) clamp(8px, 1.5vw, 12px)" }}>Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "12px", background: "#fafafa", textAlign: "center" }}>
      <div style={{ color: "#666", fontSize: "clamp(11px, 1.8vw, 12px)", marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: "bold", color: "#1f2937" }}>{value}</div>
    </div>
  );
}
