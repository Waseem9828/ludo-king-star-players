import { useState } from "react";
import useSWR from "swr";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { WhatsappIcon } from "../../components/Icons.jsx";

export default function AdminContacts() {
  const { data: contacts, error, mutate } = useSWR("/admin/contacts");
  const loading = !contacts && !error;

  const [searchTerm, setSearchTerm] = useState("");

  const filtered = (contacts || []).filter((c) => {
    const text = `${c.name || ""} ${c.phone || ""} ${c.fetchedBy || ""}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase().trim());
  });

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <h1>📚 Potential Leads</h1>
        <span className="admin-page-header__subtitle">
          View unregistered contacts fetched from users' devices
        </span>
      </div>

      {error && <p className="notice-banner error">{error?.message || "Failed to load contacts."}</p>}

      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by contact name, phone, or referring player..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <Loading label="Loading contacts..." />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="📇"
            title="No Contacts Found"
            description="No unregistered contacts have been synced yet."
          />
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Phone Number</th>
                <th>Referred By (Player)</th>
                <th>Sync Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: "bold" }}>{c.name}</td>
                  <td style={{ fontFamily: "monospace" }}>{c.phone}</td>
                  <td>
                    <span style={{ fontWeight: "500", display: "block" }}>{c.fetchedBy}</span>
                    <span className="text-muted" style={{ fontSize: "12px" }}>{c.fetchedByPhone}</span>
                  </td>
                  <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <a
                      href={`https://wa.me/91${c.phone}?text=${encodeURIComponent(
                        "Hello! Your friend " + c.fetchedBy + " thought you might enjoy ludo King adda .com. Check us out!"
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ background: "#25D366", color: "white", padding: "4px 10px", border: "none" }}
                    >
                      <WhatsappIcon size={14} color="#ffffff" /> Message
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
