import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "14px",
};

const buttonStyle = {
  border: 0,
  borderRadius: "8px",
  padding: "10px 14px",
  color: "white",
  background: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function RfidSchedules({ user }) {
  const BASE_URL = getApiBaseUrl();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [weekday, setWeekday] = useState("0");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const getHeaders = async (includeJson = false) => {
    const { data } = await supabase.auth.getSession();
    const headers = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    if (includeJson) headers["Content-Type"] = "application/json";
    return headers;
  };

  const loadSchedules = async () => {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/rfid/teacher/schedules`, { headers });
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data.detail || "Could not load class schedules.");
    setSchedules(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    const loadPage = async () => {
      try {
        const jwt = await getHeaders();
        const email = (user?.email || "").trim().toLowerCase();
        const courseParams = new URLSearchParams();
        if (email) courseParams.set("teacherEmail", email);
        const [courseResponse, roomResponse, scheduleResponse] = await Promise.all([
          fetch(`${BASE_URL}/courses/teacher?${courseParams.toString()}`, { headers: jwt }),
          fetch(`${BASE_URL}/rfid/rooms`),
          fetch(`${BASE_URL}/rfid/teacher/schedules`, { headers: jwt }),
        ]);
        const [courseData, roomData, scheduleData] = await Promise.all([
          courseResponse.json().catch(() => []),
          roomResponse.json().catch(() => []),
          scheduleResponse.json().catch(() => []),
        ]);
        if (!courseResponse.ok) throw new Error(courseData.detail || "Could not load assigned courses.");
        if (!roomResponse.ok) throw new Error(roomData.detail || "Could not load RFID rooms.");
        if (!scheduleResponse.ok) throw new Error(scheduleData.detail || "Could not load RFID schedules.");
        if (!mounted) return;
        const nextCourses = Array.isArray(courseData) ? courseData : [];
        const nextRooms = Array.isArray(roomData) ? roomData : [];
        setCourses(nextCourses);
        setRooms(nextRooms);
        setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
        setCourseId((current) => current || nextCourses[0]?.id || "");
        setRoomName((current) => current || nextRooms[0]?.room_name || "");
      } catch (err) {
        if (mounted) setError(err.message || "Could not load RFID schedule setup.");
      }
    };
    loadPage();
    return () => {
      mounted = false;
    };
  }, [BASE_URL, user?.email]);

  const createSchedule = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch(`${BASE_URL}/rfid/teacher/schedules`, {
        method: "POST",
        headers: await getHeaders(true),
        body: JSON.stringify({
          course_id: courseId,
          room_name: roomName,
          weekday: Number(weekday),
          start_time: startTime,
          end_time: endTime,
          timezone: "Europe/Budapest",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not create schedule.");
      setMessage(data.message || "Schedule created.");
      await loadSchedules();
    } catch (err) {
      setError(err.message || "Could not create schedule.");
    } finally {
      setBusy(false);
    }
  };

  const disableSchedule = async (id) => {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${BASE_URL}/rfid/teacher/schedules/${id}`, {
        method: "DELETE",
        headers: await getHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not disable schedule.");
      setMessage(data.message || "Schedule disabled.");
      await loadSchedules();
    } catch (err) {
      setError(err.message || "Could not disable schedule.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/home", { replace: true });
  };

  const activeCourse = courses.find((course) => course.activeSessionId);
  const headerActions = [
    {
      label: "Teacher Dashboard",
      onClick: () => navigate("/teacher-courses"),
      style: { background: "white", color: "#111827", border: "1px solid #d1d5db" },
    },
    ...(activeCourse
      ? [{
          label: "Resume QR Session",
          onClick: () => navigate("/teacher", {
            state: {
              sessionId: activeCourse.activeSessionId,
              courseId: activeCourse.id,
              courseName: activeCourse.name,
            },
          }),
          style: { background: "white", color: "#111827", border: "1px solid #d1d5db" },
        }]
      : []),
    { label: "Logout", onClick: handleLogout, style: { background: "black" } },
  ];

  return (
    <BaseLayout
      headerTitle="RFID Class Schedule"
      headerActions={headerActions}
      maxWidth="850px"
    >
      <h2 style={{ marginTop: 0 }}>Assign courses to room time slots</h2>
      <p>
        These recurring slots use the institutional time zone (Europe/Budapest). Readers are assigned to rooms;
        the schedule links your course to that room. Where an institution timetable feed is unavailable,
        lecturers can configure the recurring slot here.
      </p>
      {error && <p role="alert" style={{ color: "#991b1b", fontWeight: 700 }}>{error}</p>}
      {message && <p role="status" style={{ color: "#166534", fontWeight: 700 }}>{message}</p>}

      <form onSubmit={createSchedule} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
        <h3 style={{ marginTop: 0 }}>Create a weekly class slot</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <label>
            Course
            <select style={inputStyle} value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name} · {course.code}</option>
              ))}
            </select>
          </label>
          <label>
            Reader room
            <select style={inputStyle} value={roomName} onChange={(event) => setRoomName(event.target.value)} required>
              {rooms.map((room) => <option key={room.room_name} value={room.room_name}>{room.room_name}</option>)}
            </select>
          </label>
          <label>
            Weekday
            <select style={inputStyle} value={weekday} onChange={(event) => setWeekday(event.target.value)}>
              {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </label>
          <label>
            Start time
            <input style={inputStyle} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </label>
          <label>
            End time
            <input style={inputStyle} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>
        </div>
        <p style={{ color: "#64748b", fontSize: "13px" }}>
          Each class register snapshots room occupants 15 minutes after its scheduled start. A student must remain for
          20 minutes from the scheduled start to avoid a Left early outcome.
        </p>
        <button type="submit" style={buttonStyle} disabled={busy || !courses.length || !rooms.length}>
          {busy ? "Saving..." : "Add class slot"}
        </button>
      </form>

      <section style={{ marginTop: "20px" }}>
        <h3>Active slots</h3>
        {!schedules.length ? (
          <p>No RFID class slots have been set up yet.</p>
        ) : schedules.map((schedule) => (
          <div key={schedule.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "12px", marginBottom: "8px", background: "white", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
            <div>
              <strong>{schedule.course_name}</strong> · {schedule.course_code}
              <div>{weekdays[schedule.weekday]} · {schedule.start_time}–{schedule.end_time} · {schedule.room_name}</div>
            </div>
            <button type="button" style={{ ...buttonStyle, background: "#991b1b" }} onClick={() => disableSchedule(schedule.id)}>
              Disable
            </button>
          </div>
        ))}
      </section>
    </BaseLayout>
  );
}
