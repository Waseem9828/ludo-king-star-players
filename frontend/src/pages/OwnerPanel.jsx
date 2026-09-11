import { ChevronRightIcon } from "../components/Icons.jsx";

const stats = [
  { label: "Total Admins", value: "0" },
  { label: "Total Players", value: "0" },
  { label: "Platform Revenue", value: "₹0" },
];

const tools = ["Manage Admins", "App Settings", "Revenue Reports", "Audit Logs"];

export default function OwnerPanel() {
  return (
    <div className="stack">
      <h1>Owner Panel</h1>
      <p className="notice-banner">Owner functionality will be implemented in a future step.</p>

      <div className="grid grid-3">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card list-card">
        {tools.map((tool) => (
          <button key={tool} className="list-item">
            <span>{tool}</span>
            <ChevronRightIcon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
