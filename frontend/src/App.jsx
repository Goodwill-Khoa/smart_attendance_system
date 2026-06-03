import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./services/supabase";
import { AUTH_ROLES, clearAuthRole, getAuthRole } from "./services/authRole";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Scan from "./pages/Scan";
import Teacher from "./pages/Teacher";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherPassword from "./pages/TeacherPassword";
import TeacherCourses from "./pages/TeacherCourses";
import StudentCourses from "./pages/StudentCourses";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import StudentFlow from "./pages/StudentFlow";
import AuthCallback from "./pages/AuthCallback";

function StudentRoute({ user, role, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (role !== AUTH_ROLES.STUDENT) return <Navigate to="/home" replace />;
  const email = (user.email || "").toLowerCase();
  return children;
}

function TeacherRoute({ user, role, children }) {
  if (!user) return <Navigate to="/teacher-login" replace />;
  if (role !== AUTH_ROLES.TEACHER) return <Navigate to="/home" replace />;
  return children;
}

function AdminRoute({ user, role, children }) {
  if (!user) return <Navigate to="/admin-login" replace />;
  if (role !== AUTH_ROLES.ADMIN) return <Navigate to="/home" replace />;
  return children;
}

function roleHomePath(role) {
  if (role === AUTH_ROLES.ADMIN) return "/admin";
  if (role === AUTH_ROLES.TEACHER) return "/teacher-courses";
  if (role === AUTH_ROLES.STUDENT) return "/student";
  return "/home";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");

  //  统一处理用户（兼容 Microsoft 没有 email）
  const handleUser = async (rawUser) => {
    if (!rawUser) {
      setUser(null);
      setRole(getAuthRole());
      return;
    }

    // 兼容 Microsoft
    const email =
      rawUser.email ||
      rawUser.user_metadata?.email ||
      rawUser.user_metadata?.preferred_username;

    if (!email) {
      console.log(" No email info:", rawUser);
      setError("Cannot retrieve account info");
      await supabase.auth.signOut();
      setUser(null);
      return;
    }

    console.log(" Login email:", email);

    const persistedRole = getAuthRole();
    if (!persistedRole) {
      setError("Session found without role context. Please sign in again from the correct portal.");
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      clearAuthRole();
      return;
    }

    setUser({ ...rawUser, email });
    setRole(persistedRole);
    setError("");
  };

  // 初始化 + 监听登录
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      handleUser(data.session?.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        handleUser(session?.user);
        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);
  
  if (loading) {
    return <div>Loading auth...</div>;
  }
  return (
    <BrowserRouter>

      {/* 全局错误提示 */}
      {error && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255, 80, 80, 0.95)",
            color: "white",
            padding: "12px 20px",
            borderRadius: "12px",
            zIndex: 9999,
            fontSize: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }}
        >
          {error}
        </div>
      )}

      <Routes>

        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* 首页：已登录自动跳 scan */}
        <Route
          path="/home"
          element={user ? <Navigate to={roleHomePath(role)} replace /> : <Home />}
        />

        {/* 登录页 */}
        <Route path="/login" element={user ? <Navigate to={roleHomePath(role)} replace /> : <Login />} />

        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* 教师登录页 */}
        <Route path="/teacher-login" element={user ? <Navigate to={roleHomePath(role)} replace /> : <TeacherLogin />} />

        <Route path="/admin-login" element={user ? <Navigate to={roleHomePath(role)} replace /> : <AdminLogin />} />

        <Route
          path="/teacher-password"
          element={
            <TeacherRoute user={user} role={role}>
              <TeacherPassword />
            </TeacherRoute>
          }
        />

        {/* 教师课程 */}
        <Route
          path="/teacher-courses"
          element={
            <TeacherRoute user={user} role={role}>
              <TeacherCourses user={user} />
            </TeacherRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute user={user} role={role}>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* 教师二维码 */}
        <Route
          path="/teacher"
          element={
            <TeacherRoute user={user} role={role}>
              <Teacher />
            </TeacherRoute>
          }
        />

        {/* 学生课程 */}
        <Route
          path="/student"
          element={
            <StudentRoute user={user} role={role}>
              <StudentFlow user={user} />
            </StudentRoute>
          }
        />

        <Route
          path="/courses"
          element={
            <StudentRoute user={user} role={role}>
              <StudentCourses user={user} />
            </StudentRoute>
          }
        />

        {/* 扫码页（受保护） */}
        <Route
          path="/scan"
          element={
            <StudentRoute user={user} role={role}>
              <Scan user={user} />
            </StudentRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/home" replace />} />

      </Routes>
    </BrowserRouter>
  );
}