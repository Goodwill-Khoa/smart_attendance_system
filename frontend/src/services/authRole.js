const AUTH_ROLE_KEY = "smart_attendance_role";

export const AUTH_ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
};

export function setAuthRole(role) {
  if (!role) return;
  localStorage.setItem(AUTH_ROLE_KEY, role);
}

export function getAuthRole() {
  const role = localStorage.getItem(AUTH_ROLE_KEY);
  if (role === AUTH_ROLES.STUDENT || role === AUTH_ROLES.TEACHER || role === AUTH_ROLES.ADMIN) {
    return role;
  }
  return null;
}

export function clearAuthRole() {
  localStorage.removeItem(AUTH_ROLE_KEY);
}
