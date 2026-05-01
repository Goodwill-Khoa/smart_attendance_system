import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./services/supabase";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Scan from "./pages/Scan";
import Teacher from "./pages/Teacher";
import TeacherLogin from "./pages/TeacherLogin";

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  //  统一处理用户（兼容 Microsoft 没有 email）
  const handleUser = async (rawUser) => {
    if (!rawUser) {
      setUser(null);
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

    // 用 Azure 限制域名
    setUser({ ...rawUser, email });
    setError("");
  };

  // 初始化 + 监听登录
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      handleUser(data.session?.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        handleUser(session?.user);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

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

        {/* 首页：已登录自动跳 scan */}
        <Route
          path="/"
          element={user ? <Navigate to="/scan" /> : <Home />}
        />

        {/* 登录页 */}
        <Route path="/login" element={<Login />} />

        {/* 教师登录页 */}
        <Route path="/teacher-login" element={<TeacherLogin />} />

        {/* 教师页 */}
        <Route path="/teacher" element={<Teacher />} />

        {/* 扫码页（受保护） */}
        <Route
          path="/scan"
          element={
            <ProtectedRoute user={user}>
              <Scan user={user} />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}