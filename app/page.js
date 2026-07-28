"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = ["Awaiting Files", "Ready for Editing", "Complete"];
const STATUS_LABELS = {
  "Awaiting Files": "Awaiting Files",
  "Ready for Editing": "Editing",
  "Complete": "Complete"
};
const PACKAGE_DETAILS = [
  {
    pattern: /first impressions?\s+package/i,
    name: "First Impressions Package",
    includes: "Photos + Drone Photos + Virtual Twilight Photo + Floor Plan"
  },
  {
    pattern: /listing ac(?:c)?elerator\s+package/i,
    name: "Listing Accelerator Package",
    includes: "Photos + Drone Photos + Virtual Twilight Photo + Floor Plan + 3D Tour"
  },
  {
    pattern: /sold yesterday\s+package/i,
    name: "Sold Yesterday Package",
    includes: "Photos + Drone Photos + Virtual Twilight Photo + Floor Plan + Video"
  }
];

function safeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseOrderItems(value) {
  const cleaned = safeText(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(first impressions?|listing ac(?:c)?elerator|sold yesterday)\s+package\s*[=:]/i.test(line));

  const text = lines.join("\n").trim();
  const packageInfo = PACKAGE_DETAILS.find((item) => item.pattern.test(text));
  return { text, packageInfo };
}

function StatusPill({ value, onChange, saving }) {
  const status = STATUS_OPTIONS.includes(value) ? value : "Awaiting Files";
  return (
    <label className={`status status-${status.toLowerCase().replaceAll(" ", "-")}`}>
      <span className="status-dot" />
      <select
        aria-label="Project status"
        value={status}
        disabled={saving}
        onChange={(event) => onChange(event.target.value)}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>{STATUS_LABELS[option]}</option>
        ))}
      </select>
    </label>
  );
}

function AttachmentGallery({ attachments = [], onSelect }) {
  if (!attachments.length) return null;
  return (
    <div className="attachments">
      {attachments.map((file) => (
        <button
          className="attachment"
          key={file.id || file.url}
          type="button"
          onClick={() => onSelect(file)}
          aria-label={`Open ${file.filename || "attachment"}`}
        >
          {file.type?.startsWith("image/") ? (
            // Airtable attachment URLs are temporary and intentionally rendered directly.
            <img src={file.thumbnails?.large?.url || file.url} alt={file.filename || "Project attachment"} />
          ) : (
            <span>Open attachment</span>
          )}
        </button>
      ))}
    </div>
  );
}

function ProjectCard({ project, password, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const orderItems = parseOrderItems(project.orderItems);
  const hasAlert = Boolean(project.customerNotes || project.skylineNotes);

  useEffect(() => {
    if (!selectedAttachment) return;
    function closeOnEscape(event) {
      if (event.key === "Escape") setSelectedAttachment(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedAttachment]);

  async function updateStatus(status) {
    setSaving(true);
    try {
      await onStatusChange(project.id, status, password);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`project-card ${hasAlert ? "has-alert" : ""}`}>
      <button className="card-main" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <div className="card-heading">
          <div>
            <div className="customer">{project.customerName || "Customer not listed"}</div>
            <h2>{project.propertyAddress || "Address not listed"}</h2>
          </div>
          <span className={`chevron ${open ? "open" : ""}`} aria-hidden="true">⌄</span>
        </div>

        <div className="summary">
          <div>
            <span className="eyebrow">ORDER ITEMS</span>
            <div className="order-line">
              <p>{orderItems.text || "No order items listed"}</p>
              {orderItems.packageInfo && (
                <span className="package-preview" tabIndex="0">
                  <span className="package-info-icon" aria-hidden="true">i</span>
                  <span className="package-tooltip" role="tooltip">
                    <strong>{orderItems.packageInfo.name}</strong>
                    <span>{orderItems.packageInfo.includes}</span>
                  </span>
                </span>
              )}
            </div>
          </div>
          {hasAlert && (
            <div className="alert">
              <span aria-hidden="true">!</span>
              Notes attached
            </div>
          )}
        </div>
      </button>

      <div className="card-actions">
        <StatusPill value={project.status} saving={saving} onChange={updateStatus} />
        {project.aryeoOrderLink && (
          <a className="link-button aryeo-button" href={project.aryeoOrderLink} target="_blank" rel="noreferrer">
            Open Aryeo ↗
          </a>
        )}
        {project.fotelloLink && (
          <a className="link-button" href={project.fotelloLink} target="_blank" rel="noreferrer">
            Open Fotello ↗
          </a>
        )}
      </div>

      {open && (
        <div className="details">
          <div className="note-grid">
            <section className={project.customerNotes ? "note important" : "note"}>
              <h3>Customer / Order Notes</h3>
              <p>{project.customerNotes || "No customer notes."}</p>
            </section>
            <section className={project.skylineNotes ? "note important" : "note"}>
              <h3>Skyline Notes</h3>
              <p>{project.skylineNotes || "No Skyline notes."}</p>
            </section>
          </div>
          <AttachmentGallery attachments={project.attachments} onSelect={setSelectedAttachment} />
        </div>
      )}

      {selectedAttachment && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Project attachment">
          <button className="lightbox-backdrop" onClick={() => setSelectedAttachment(null)} aria-label="Close attachment" />
          <div className="lightbox-content">
            <button className="lightbox-close" onClick={() => setSelectedAttachment(null)} aria-label="Close attachment">×</button>
            {selectedAttachment.type?.startsWith("image/") ? (
              <img src={selectedAttachment.url} alt={selectedAttachment.filename || "Project attachment"} />
            ) : (
              <a href={selectedAttachment.url}>Open attachment</a>
            )}
            {selectedAttachment.filename && <p>{selectedAttachment.filename}</p>}
          </div>
        </div>
      )}
    </article>
  );
}

export default function Home() {
  const [password, setPassword] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("skylineEditorPassword");
    if (saved) setPassword(saved);
  }, []);

  const loadProjects = useCallback(async (secret, quiet = false) => {
    if (!secret) return;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        headers: { "x-editor-password": secret },
        cache: "no-store"
      });
      if (response.status === 401) throw new Error("Incorrect access password.");
      if (!response.ok) throw new Error("The dashboard could not load Airtable.");
      const data = await response.json();
      setProjects(data.projects || []);
      setLastUpdated(new Date());
      setError("");
    } catch (loadError) {
      setError(loadError.message);
      if (loadError.message.includes("Incorrect")) {
        window.sessionStorage.removeItem("skylineEditorPassword");
        setPassword("");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!password) return;
    loadProjects(password);
    const timer = window.setInterval(() => loadProjects(password, true), 60000);
    return () => window.clearInterval(timer);
  }, [password, loadProjects]);

  async function changeStatus(id, status, secret) {
    const previous = projects;
    setProjects((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    const response = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-editor-password": secret
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      setProjects(previous);
      setError("That status did not save. Please try again.");
      throw new Error("Status update failed");
    }
    setError("");
  }

  const counts = useMemo(() => ({
    total: projects.length,
    editing: projects.filter((item) => item.status === "Ready for Editing").length,
    complete: projects.filter((item) => item.status === "Complete").length
  }), [projects]);

  function unlock(event) {
    event.preventDefault();
    const value = draftPassword.trim();
    if (!value) return;
    window.sessionStorage.setItem("skylineEditorPassword", value);
    setPassword(value);
  }

  if (!password) {
    return (
      <main className="login-shell">
        <form className="login-card" onSubmit={unlock}>
          <div className="brand-mark">S</div>
          <p className="kicker">SKYLINE IMAGERY</p>
          <h1>Editor Hub</h1>
          <p className="login-copy">Enter the private editor password to view today’s projects.</p>
          <label>
            Access password
            <input
              type="password"
              value={draftPassword}
              onChange={(event) => setDraftPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <button type="submit">Open Today’s Projects</button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark small">S</div>
          <div><strong>Skyline</strong><span>Editor Hub</span></div>
        </div>
        <div className="top-actions">
          <span className="live"><i /> Live</span>
          <button className="refresh" onClick={() => loadProjects(password)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="dashboard">
        <section className="hero">
          <div>
            <p className="kicker">TODAY’S WORKFLOW</p>
            <h1>Today’s Projects</h1>
            <p className="date">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
          </div>
          <div className="metrics">
            <div><strong>{counts.total}</strong><span>Projects</span></div>
            <div><strong>{counts.editing}</strong><span>Editing</span></div>
            <div><strong>{counts.complete}</strong><span>Complete</span></div>
          </div>
        </section>

        {error && <div className="error-banner">{error}</div>}

        <section className="project-list" aria-live="polite">
          {loading && !projects.length ? (
            <div className="empty"><div className="spinner" /><h2>Loading today’s projects…</h2></div>
          ) : projects.length ? (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                password={password}
                onStatusChange={changeStatus}
              />
            ))
          ) : (
            <div className="empty">
              <div className="empty-check">✓</div>
              <h2>No active projects today</h2>
              <p>Anything scheduled later will appear here automatically.</p>
            </div>
          )}
        </section>

        <footer>
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
          <button onClick={() => {
            window.sessionStorage.removeItem("skylineEditorPassword");
            setPassword("");
          }}>Lock dashboard</button>
        </footer>
      </div>
    </main>
  );
}
