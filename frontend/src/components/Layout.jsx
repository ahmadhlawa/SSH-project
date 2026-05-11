import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader.jsx";
import EmergencyModal from "./EmergencyModal.jsx";
import Sidebar from "./Sidebar.jsx";
import { useSafety } from "../context/SafetyContext.jsx";

export default function Layout() {
  const { activeDangerWorker, activeDangerAlert } = useSafety();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`app-shell ${activeDangerWorker ? "emergency-mode" : ""}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <button
        className={`sidebar-scrim ${sidebarOpen ? "visible" : ""}`}
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setSidebarOpen(false)}
      />
      <main className={`main-content ${activeDangerWorker ? "is-blurred" : ""}`}>
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </main>
      <EmergencyModal worker={activeDangerWorker} alert={activeDangerAlert} />
    </div>
  );
}
