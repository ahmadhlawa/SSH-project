import { AlertTriangle, Gauge, Map, Settings, ShieldAlert, X } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/map", label: "Map", icon: Map },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/settings", label: "Settings", icon: Settings }
];

export default function Sidebar({ open = false, onClose }) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="Smart Safety Helmet" />
        <button className="icon-btn sidebar-close" type="button" aria-label="Close navigation menu" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      <div className="brand-copy">
        <strong>Smart Helmet</strong>
        <span>Safety Monitor</span>
      </div>
      <nav className="nav-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-emergency">
        <ShieldAlert size={20} />
        <div>
          <strong>Emergency Ready</strong>
          <span>Alarms stay active until acknowledgement.</span>
        </div>
      </div>
    </aside>
  );
}
