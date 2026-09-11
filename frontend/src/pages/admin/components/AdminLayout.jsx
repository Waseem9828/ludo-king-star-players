import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { MenuIcon } from "../../../components/Icons.jsx";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminBottomNav from "./AdminBottomNav.jsx";
import "./AdminLayout.css";
import "./admin.css";

export default function AdminLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleMenuClick = () => setSidebarOpen(true);

  return (
    <div className="admin-layout-wrapper">
      <Toaster position="top-center" toastOptions={{ style: { background: '#ffffff', color: '#17233C', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }} />
      
      <header className="admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="icon-btn admin-header__menu" onClick={handleMenuClick} aria-label="Open menu" style={{ color: "var(--text)", width: "36px", height: "36px" }}>
            <MenuIcon size={22} />
          </button>
          <div className="admin-header__brand">
            <span style={{ fontSize: "18px" }}>⌘</span> MPC Admin
          </div>
        </div>
        
        <button 
          className="btn btn-sm admin-exit-desktop" 
          style={{ 
            background: "rgba(239, 68, 68, 0.08)", 
            border: "1px solid rgba(239,68,68,0.15)", 
            color: "#ef4444", 
            fontWeight: "700",
            minHeight: "34px",
            padding: "0 12px",
            borderRadius: "10px",
            fontSize: "12px"
          }}
          onClick={() => navigate("/")}
        >
          Exit Admin
        </button>
      </header>

      <div className="admin-body">
        <AdminSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
      
      <AdminBottomNav />
    </div>
  );
}
