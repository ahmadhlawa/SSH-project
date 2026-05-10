import { Outlet } from "react-router-dom";
import ConnectionStatus from "./ConnectionStatus.jsx";
import EmergencyModal from "./EmergencyModal.jsx";
import Sidebar from "./Sidebar.jsx";
import { useSafety } from "../context/SafetyContext.jsx";

export default function Layout() {
  const { activeDangerWorker } = useSafety();

  return (
    <div className={`app-shell ${activeDangerWorker ? "emergency-mode" : ""}`}>
      <Sidebar />
      <main className={`main-content ${activeDangerWorker ? "is-blurred" : ""}`}>
        <ConnectionStatus />
        <Outlet />
      </main>
      <EmergencyModal worker={activeDangerWorker} />
    </div>
  );
}
