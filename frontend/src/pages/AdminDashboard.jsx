import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../services/apiBase";
import { supabase } from "../services/supabase";

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

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

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
      console.error(err);
      setError("Network error while verifying admin access.");
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
        fetch(`${BASE_URL}/admin/overview`, {
          headers,
        }),
        fetch(`${BASE_URL}/admin/sessions/active`, {
          headers,
        }),
        fetch(`${BASE_URL}/admin/course-requests`, {
          headers,
        }),
        fetch(`${BASE_URL}/admin/lecturers`, {
          headers,
        }),
        fetch(`${BASE_URL}/admin/password-requests`, {
          headers,
        }),
      ]);

      if (!overviewRes.ok) {
        const data = await overviewRes.json();
        setError(data.detail || "Failed to load admin overview.");
        setOverview(null);
        setActiveSessions([]);
        setCourseRequests([]);
        setLecturers([]);
        setPasswordRequests([]);
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
      setSelectedLecturerId((current) => {
        if (current && nextLecturers.some((item) => item.id === current)) {
          return current;
        }
        return nextLecturers[0]?.id || "";
      });
      setPasswordRequests(Array.isArray(passwordRequestsData) ? passwordRequestsData : []);
    } catch (err) {
      console.error(err);
      setError("Network error while loading admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId) => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/course-requests/${requestId}/approve`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to approve request.");
        return;
      }

      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError("Network error while approving request.");
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/course-requests/${requestId}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to reject request.");
        return;
      }

      setSuccessMessage(data.message || "Course request rejected.");
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError("Network error while rejecting request.");
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

    const confirmed = window.confirm("if the wish to end all sessions");
    if (!confirmed) return;

    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch(`${BASE_URL}/admin/sessions/end-all`, {
        method: "POST",
        headers,
        body: JSON.stringify({ comment }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to end all sessions.");
        return;
      }

      setSuccessMessage(data.message || "All sessions were ended.");
      setEmergencyComment("");
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError("Network error while ending all sessions.");
    }
  };

  const handleAddLecturer = async () => {
    setError("");
    setSuccessMessage("");
    setLatestTempPassword("");

    const email = lecturerEmail.trim().toLowerCase();
    const fullName = lecturerFullName.trim();
    const title = lecturerTitle.trim() || "Lecturer";

    if (!email) {
      setError("Lecturer email is required.");
      return;
    }
    if (!fullName) {
      setError("Lecturer full name is required.");
      return;
    }

    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch(`${BASE_URL}/admin/lecturers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          full_name: fullName,
          email,
          is_admin: newLecturerIsAdmin,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to add lecturer.");
        return;
      }

      setSuccessMessage(data.message || "Lecturer saved.");
      if (data.tempPassword) {
        setLatestTempPassword(data.tempPassword);
      }
      if (data.authProvisioned === false) {
        setError(data.authMessage || "Supabase auth provisioning failed. Configure service role key.");
      }
      setLecturerTitle("Lecturer");
      setLecturerFullName("");
      setLecturerEmail("");
      setNewLecturerIsAdmin(false);
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError("Network error while adding lecturer.");
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
    setLatestTempPassword("");

    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/lecturers/${selectedLecturer.id}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to remove lecturer.");
        return;
      }

      setSuccessMessage(data.message || "Lecturer removed.");
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError("Network error while removing lecturer.");
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
      console.error(err);
      setError("Network error while updating admin access.");
    }
  };

  const handleIssueTempPassword = async (requestId) => {
    setError("");
    setSuccessMessage("");
    setLatestTempPassword("");

    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`${BASE_URL}/admin/password-requests/${requestId}/issue-temp-password`, {
        method: "POST",
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Failed to issue temporary password.");
        return;
      }

      setSuccessMessage(data.message || "Temporary password issued.");
      if (data.tempPassword) {
        setLatestTempPassword(data.tempPassword);
      }
      if (data.authProvisioned === false) {
        setError(data.authMessage || "Supabase auth update failed. Configure service role key.");
      }

      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError("Network error while issuing temporary password.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    (async () => {
      const allowed = await verifyAdminSession();
      if (allowed) {
        await loadDashboard();
      }
      setAuthChecking(false);
    })();
  }, []);

  if (authChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f4ef" }}>
        <div style={{ color: "#374151", fontWeight: 600 }}>Checking admin access...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f4f4ef 0%, #e9efe9 100%)",
        padding: "28px",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 20px 45px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: "8px" }}>Super User Dashboard</h1>
            <p style={{ color: "#666", marginTop: 0 }}>
              Backend monitoring and lecturer access management
            </p>
            {adminIdentity?.email && (
              <div style={{ color: "#4b5563", fontSize: "14px" }}>
                Signed in as {adminIdentity.email}
                {adminIdentity.isBootstrap ? " • bootstrap admin access" : ""}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => navigate("/home")}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                background: "white",
                color: "#1f2937",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Home
            </button>
            <button
              onClick={handleLogout}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                background: "#111827",
                color: "white",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
          <button
            onClick={loadDashboard}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: "10px",
              background: "#1f2a37",
              color: "white",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#ffe9e9",
              color: "#8c1111",
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              background: "#e7f8ea",
              color: "#14532d",
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "18px",
            }}
          >
            {successMessage}
          </div>
        )}

        {latestTempPassword && (
          <div
            style={{
              background: "#fff8db",
              color: "#7a4e00",
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "18px",
              border: "1px solid #f0cf79",
            }}
          >
            Temporary password generated: <b>{latestTempPassword}</b>
          </div>
        )}

        {overview && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginBottom: "22px",
            }}
          >
            <StatCard title="Users" value={overview.users} />
            <StatCard title="Courses" value={overview.courses} />
            <StatCard title="Active" value={overview.activeSessions} />
            <StatCard title="Sessions" value={overview.totalSessions} />
            <StatCard title="Attendance" value={overview.attendanceLogs} />
          </div>
        )}

        {canManageLecturers && (
          <>
            <h3 style={{ marginBottom: "10px" }}>Lecturers</h3>
            <div
              style={{
                border: "1px solid #d8dee6",
                borderRadius: "12px",
                background: "#f8fbff",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr 1fr auto",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <input
                  type="text"
                  placeholder="Title"
                  value={lecturerTitle}
                  onChange={(e) => setLecturerTitle(e.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Full name"
                  value={lecturerFullName}
                  onChange={(e) => setLecturerFullName(e.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                />
                <input
                  type="email"
                  placeholder="Lecturer email"
                  value={lecturerEmail}
                  onChange={(e) => setLecturerEmail(e.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}
                />
                <button
                  onClick={handleAddLecturer}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: "#1d4ed8",
                    color: "white",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Add Lecturer
                </button>
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#374151",
                  fontSize: "14px",
                  marginBottom: "14px",
                }}
              >
                <input
                  type="checkbox"
                  checked={newLecturerIsAdmin}
                  onChange={(e) => setNewLecturerIsAdmin(e.target.checked)}
                />
                Grant admin access to this lecturer
              </label>

              {lecturers.length === 0 ? (
                <p style={{ margin: 0, color: "#555" }}>No lecturers in DB yet.</p>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  <select
                    value={selectedLecturerId}
                    onChange={(e) => setSelectedLecturerId(e.target.value)}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      background: "white",
                      color: "#1f2937",
                      WebkitTextFillColor: "#1f2937",
                    }}
                  >
                    {lecturers.map((item) => (
                      <option key={item.id} value={item.id} style={{ color: "#1f2937", background: "white" }}>
                        {(item.fullName || item.name) + " - " + item.email}
                      </option>
                    ))}
                  </select>

                  {selectedLecturer && (
                    <div
                      style={{
                        border: "1px solid #dbe4ee",
                        borderRadius: "10px",
                        padding: "12px",
                        background: "white",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#1f2937" }}>
                        {selectedLecturer.fullName || selectedLecturer.name}
                      </div>
                      <div style={{ color: "#4b5563", fontSize: "14px" }}>
                        {selectedLecturer.title || "Lecturer"}
                      </div>
                      <div style={{ color: "#4b5563", fontSize: "14px" }}>{selectedLecturer.email}</div>
                      <div style={{ color: "#4b5563", fontSize: "13px", marginTop: "6px" }}>
                        Admin access: {selectedLecturer.isAdmin ? "Enabled" : "Disabled"}
                      </div>
                      {selectedLecturer.mustChangePassword && (
                        <div style={{ color: "#92400e", fontSize: "12px", marginTop: "4px" }}>
                          Must change password on next login
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => handleSetLecturerAdminAccess(!selectedLecturer.isAdmin)}
                          style={{
                            border: "none",
                            borderRadius: "10px",
                            background: selectedLecturer.isAdmin ? "#475569" : "#1d4ed8",
                            color: "white",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {selectedLecturer.isAdmin ? "Remove Admin Access" : "Assign as Admin"}
                        </button>
                        <button
                          onClick={handleRemoveSelectedLecturer}
                          style={{
                            border: "none",
                            borderRadius: "10px",
                            background: "#b91c1c",
                            color: "white",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Remove Lecturer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <h3 style={{ marginBottom: "10px" }}>Password Requests</h3>
            {passwordRequests.length === 0 ? (
              <p style={{ color: "#555", marginTop: 0 }}>No password requests.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
                {passwordRequests.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.lecturerName || "Lecturer"}</div>
                    <div style={{ color: "#4b5563", fontSize: "14px" }}>{item.lecturerTitle || "Lecturer"}</div>
                    <div style={{ color: "#4b5563", fontSize: "14px" }}>{item.lecturerEmail}</div>
                    <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
                      Status: {item.status}
                    </div>
                    {item.status === "PENDING" && (
                      <button
                        onClick={() => handleIssueTempPassword(item.id)}
                        style={{
                          marginTop: "10px",
                          border: "none",
                          borderRadius: "10px",
                          background: "#1f6f3f",
                          color: "white",
                          padding: "8px 12px",
                          cursor: "pointer",
                        }}
                      >
                        Issue Temp Password
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <h3 style={{ marginBottom: "10px" }}>Active Sessions</h3>
        {canManageLecturers && (
          <div
            style={{
              border: "1px solid #f3b2b2",
              borderRadius: "12px",
              background: "#fff3f3",
              padding: "12px",
              marginBottom: "14px",
            }}
          >
            <div style={{ fontWeight: 700, color: "#9f1239", marginBottom: "8px" }}>
              Emergency Protocol
            </div>
            <textarea
              value={emergencyComment}
              onChange={(e) => setEmergencyComment(e.target.value)}
              placeholder="Write the emergency message to be shown to all active sessions"
              rows={3}
              style={{
                width: "100%",
                resize: "vertical",
                border: "1px solid #d4d4d8",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "10px",
              }}
            />
            <button
              onClick={handleEndAllSessions}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#b91c1c",
                color: "white",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              End All Sessions (Emergency Protocol)
            </button>
          </div>
        )}

        {activeSessions.length === 0 ? (
          <p style={{ color: "#555" }}>No active sessions.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {activeSessions.map((item) => (
              <div
                key={item.sessionId}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                <div style={{ fontWeight: "bold" }}>{item.courseName}</div>
                <div style={{ color: "#666", fontSize: "14px" }}>
                  {item.courseCode} • {item.semester}
                </div>
                <div style={{ color: "#666", fontSize: "13px", marginTop: "6px" }}>
                  Session: {item.sessionId}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManageLecturers && (
          <>
            <h3 style={{ marginTop: "24px", marginBottom: "10px" }}>Course Requests</h3>
            {courseRequests.length === 0 ? (
              <p style={{ color: "#555" }}>No pending requests.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {courseRequests.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>
                      {item.name} ({item.courseType})
                    </div>
                    <div style={{ color: "#666", fontSize: "14px" }}>
                      {item.code || "No code"} • {item.semester}
                    </div>
                    <div style={{ color: "#666", fontSize: "13px", marginTop: "6px" }}>
                      Requested by: {item.teacherEmail} • {item.status}
                    </div>
                    {item.status === "PENDING" && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => approveRequest(item.id)}
                          style={{
                            border: "none",
                            borderRadius: "10px",
                            background: "#1f6f3f",
                            color: "white",
                            padding: "8px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectRequest(item.id)}
                          style={{
                            border: "none",
                            borderRadius: "10px",
                            background: "#b91c1c",
                            color: "white",
                            padding: "8px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Reject
                        </button>
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
  );
}

function StatCard({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "12px",
        background: "#fafafa",
      }}
    >
      <div style={{ color: "#666", fontSize: "13px" }}>{title}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
