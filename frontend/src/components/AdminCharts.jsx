import { useState } from "react";

export function RevenueTrendChart({ data = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) return null;

  const width = 580;
  const height = 200;
  const padding = 30;

  const maxVal = Math.max(...data.map((d) => Math.max(d.deposits, d.withdrawals, 100)));

  const pointsDep = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.deposits / maxVal) * (height - padding * 2);
    return { x, y, val: d.deposits, day: d.day, date: d.date };
  });

  const pointsWd = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.withdrawals / maxVal) * (height - padding * 2);
    return { x, y, val: d.withdrawals, day: d.day, date: d.date };
  });

  const pathDDep = pointsDep.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");
  const areaDDep = `${pathDDep} L ${pointsDep[pointsDep.length - 1].x} ${height - padding} L ${pointsDep[0].x} ${height - padding} Z`;

  const pathDWd = pointsWd.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="depGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.33, 0.66, 1].map((ratio, i) => {
          const y = height - padding - ratio * (height - padding * 2);
          return (
            <line
              key={i}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaDDep} fill="url(#depGradient)" />

        {/* Deposit line */}
        <path d={pathDDep} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />

        {/* Withdrawal line */}
        <path d={pathDWd} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />

        {/* Data points & X Axis labels */}
        {pointsDep.map((p, idx) => (
          <g key={idx}>
            <text
              x={p.x}
              y={height - 8}
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
            >
              {p.day}
            </text>

            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill="#6366f1"
              stroke="#ffffff"
              strokeWidth="2"
              style={{ cursor: "pointer", transition: "all 0.2s ease" }}
              onMouseEnter={() => setHoveredPoint({ ...p, type: "Deposits", color: "#6366f1" })}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          </g>
        ))}

        {pointsWd.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth="1.5"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredPoint({ ...p, type: "Withdrawals", color: "#ef4444" })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
      </svg>

      {hoveredPoint && (
        <div style={{ fontSize: "12px", color: "#f8fafc", marginTop: "4px", textAlign: "center" }}>
          <span style={{ color: hoveredPoint.color, fontWeight: "bold" }}>● {hoveredPoint.type} ({hoveredPoint.day}): </span>
          <strong>₹{hoveredPoint.val}</strong>
        </div>
      )}
    </div>
  );
}

export function MatchVolumeChart({ data = [] }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.matches), 10);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "140px", padding: "10px 0" }}>
      {data.map((d, i) => {
        const heightPct = Math.max((d.matches / maxVal) * 100, 8);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "#6366f1", fontWeight: "bold" }}>{d.matches}</span>
            <div
              style={{
                width: "100%",
                maxWidth: "24px",
                height: `${heightPct}%`,
                background: "linear-gradient(180deg, #6366f1 0%, #4338ca 100%)",
                borderRadius: "6px 6px 0 0",
                boxShadow: "0 4px 10px rgba(99, 102, 241, 0.3)",
                transition: "height 0.4s ease",
              }}
            />
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600" }}>{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthlyRevenueChart({ data = [] }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.grossRevenue, d.referralPayout, 100)));

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "140px", padding: "10px 0" }}>
      {data.map((d, i) => {
        const heightGross = Math.max((d.grossRevenue / maxVal) * 100, 2);
        const heightPayout = Math.max((d.referralPayout / maxVal) * 100, 2);
        
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            {/* Tooltip on hover simulation */}
            <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
              <div
                style={{
                  width: "12px",
                  height: `${heightGross}%`,
                  background: "#10b981",
                  borderRadius: "2px 2px 0 0",
                }}
                title={`Gross Revenue: ₹${d.grossRevenue}`}
              />
              <div
                style={{
                  width: "12px",
                  height: `${heightPayout}%`,
                  background: "#ef4444",
                  borderRadius: "2px 2px 0 0",
                }}
                title={`Referral Payouts: ₹${d.referralPayout}`}
              />
            </div>
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600", whiteSpace: "nowrap" }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
