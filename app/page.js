"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

const STATUS_OPTIONS = [
  "Awaiting Files",
  "Ready for Editing",
  "Complete"
];

const STATUS_LABELS = {
  "Awaiting Files": "Awaiting Files",
  "Ready for Editing": "Editing",
  "Complete": "Complete"
};

const PACKAGE_DETAILS = [
  {
    pattern: /first impressions?\s+package/i,
    name: "First Impressions Package",
    includes:
      "Photos + Drone Photos + Virtual Twilight Photo + Floor Plan"
  },
  {
    pattern: /listing ac(?:c)?elerator\s+package/i,
    name: "Listing Accelerator Package",
    includes:
      "Photos + Drone Photos + Virtual Twilight Photo + Floor Plan + 3D Tour"
  },
  {
    pattern: /sold yesterday\s+package/i,
    name: "Sold Yesterday Package",
    includes:
      "Photos + Drone Photos + Virtual Twilight Photo + Floor Plan + Video"
  }
];

function safeText(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : "";
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
    .filter(
      (line) =>
        !/^(first impressions?|listing ac(?:c)?elerator|sold yesterday)\s+package\s*[=:]/i.test(
          line
        )
    );

  const text = lines.join("\n").trim();

  const packageInfo = PACKAGE_DETAILS.find(
    (item) => item.pattern.test(text)
  );

  return { text, packageInfo };
}

function formatProjectDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatHours(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return Number.isInteger(number)
    ? String(number)
    : number
        .toFixed(2)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}

function StatusPill({
  value,
  onChange,
  saving
}) {
  const status = STATUS_OPTIONS.includes(value)
    ? value
    : "Awaiting Files";

  return (
    <label
      className={`status status-${status
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      <span className="status-dot" />

      <select
        aria-label="Project status"
        value={status}
        disabled={saving}
        onChange={(event) =>
          onChange(event.target.value)
        }
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function AttachmentGallery({
  attachments = [],
  onSelect
}) {
  if (!attachments.length) return null;

  return (
    <div className="attachments">
      {attachments.map((file) => (
        <button
          className="attachment"
          key={file.id || file.url}
          type="button"
          onClick={() => onSelect(file)}
          aria-label={`Open ${
            file.filename || "attachment"
          }`}
        >
          {file.type?.startsWith("image/") ? (
            <img
              src={
                file.thumbnails?.large?.url ||
                file.url
              }
              alt={
                file.filename ||
                "Project attachment"
              }
            />
          ) : (
            <span>Open attachment</span>
          )}
        </button>
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  password,
  onStatusChange
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [
    selectedAttachment,
    setSelectedAttachment
  ] = useState(null);

  const orderItems = parseOrderItems(
    project.orderItems
  );

  const hasAlert = Boolean(
    project.customerNotes ||
      project.skylineNotes
  );

  useEffect(() => {
    if (!selectedAttachment) return;

    const previousHtmlOverflow =
      document.documentElement.style.overflow;

    const previousBodyOverflow =
      document.body.style.overflow;

    document.documentElement.style.overflow =
      "hidden";

    document.body.style.overflow = "hidden";

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setSelectedAttachment(null);
      }
    }

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        closeOnEscape
      );

      document.documentElement.style.overflow =
        previousHtmlOverflow;

      document.body.style.overflow =
        previousBodyOverflow;
    };
  }, [selectedAttachment]);

  async function updateStatus(status) {
    setSaving(true);

    try {
      await onStatusChange(
        project.id,
        status,
        password
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={`project-card ${
        hasAlert ? "has-alert" : ""
      }`}
    >
      <button
        className="card-main"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-expanded={open}
      >
        <div className="card-heading">
          <div>
            <div className="customer">
              {project.customerName ||
                "Customer not listed"}
            </div>

            <h2>
              {project.propertyAddress ||
                "Address not listed"}
            </h2>
          </div>

          <span
            className={`chevron ${
              open ? "open" : ""
            }`}
            aria-hidden="true"
          >
            {"\u2304"}
          </span>
        </div>

        <div className="summary">
          <div>
            <span className="eyebrow">
              ORDER ITEMS
            </span>

            <div className="order-line">
              <p>
                {orderItems.text ||
                  "No order items listed"}
              </p>

              {orderItems.packageInfo && (
                <span
                  className="package-preview"
                  tabIndex="0"
                >
                  <span
                    className="package-info-icon"
                    aria-hidden="true"
                  >
                    i
                  </span>

                  <span
                    className="package-tooltip"
                    role="tooltip"
                  >
                    <strong>
                      {
                        orderItems.packageInfo
                          .name
                      }
                    </strong>

                    <span>
                      {
                        orderItems.packageInfo
                          .includes
                      }
                    </span>
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
        <StatusPill
          value={project.status}
          saving={saving}
          onChange={updateStatus}
        />

        {project.aryeoOrderLink && (
          <a
            className="link-button aryeo-button"
            href={project.aryeoOrderLink}
            target="_blank"
            rel="noreferrer"
          >
            Open Aryeo {"\u2197"}
          </a>
        )}

        {project.fotelloLink && (
          <a
            className="link-button"
            href={project.fotelloLink}
            target="_blank"
            rel="noreferrer"
          >
            Open Fotello {"\u2197"}
          </a>
        )}
      </div>

      {open && (
        <div className="details">
          <div className="note-grid">
            <section
              className={
                project.customerNotes
                  ? "note important"
                  : "note"
              }
            >
              <h3>
                Customer / Order Notes
              </h3>

              <p>
                {project.customerNotes ||
                  "No customer notes."}
              </p>
            </section>

            <section
              className={
                project.skylineNotes
                  ? "note important"
                  : "note"
              }
            >
              <h3>Skyline Notes</h3>

              <p>
                {project.skylineNotes ||
                  "No Skyline notes."}
              </p>
            </section>
          </div>

          <AttachmentGallery
            attachments={project.attachments}
            onSelect={setSelectedAttachment}
          />
        </div>
      )}

      {selectedAttachment &&
        createPortal(
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Project attachment"
          >
            <button
              className="lightbox-backdrop"
              onClick={() =>
                setSelectedAttachment(null)
              }
              aria-label="Close attachment"
            />

            <div className="lightbox-content">
              <button
                className="lightbox-close"
                onClick={() =>
                  setSelectedAttachment(null)
                }
                aria-label="Close attachment"
              >
                {"\u00D7"}
              </button>

              <div className="lightbox-media">
                {selectedAttachment.type?.startsWith(
                  "image/"
                ) ? (
                  <img
                    src={selectedAttachment.url}
                    alt={
                      selectedAttachment.filename ||
                      "Project attachment"
                    }
                  />
                ) : (
                  <a href={selectedAttachment.url}>
                    Open attachment
                  </a>
                )}
              </div>

              {selectedAttachment.filename && (
                <p>
                  {selectedAttachment.filename}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </article>
  );
}

export default function Home() {
  const [password, setPassword] =
    useState("");

  const [draftPassword, setDraftPassword] =
    useState("");

  const [projects, setProjects] =
    useState([]);

  const [projectDate, setProjectDate] =
    useState("");

  const [dailyHours, setDailyHours] =
    useState(null);

  const [weeklyHours, setWeeklyHours] =
    useState(0);

  const [hoursDraft, setHoursDraft] =
    useState("");

  const [savingHours, setSavingHours] =
    useState(false);

  const [hoursMessage, setHoursMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const hoursDirty = useRef(false);

  useEffect(() => {
    const saved =
      window.localStorage.getItem(
        "skylineEditorPassword"
      ) ||
      window.sessionStorage.getItem(
        "skylineEditorPassword"
      );

    if (saved) {
      window.localStorage.setItem(
        "skylineEditorPassword",
        saved
      );

      window.sessionStorage.removeItem(
        "skylineEditorPassword"
      );

      setPassword(saved);
    }
  }, []);

  const loadProjects = useCallback(
    async (secret, quiet = false) => {
      if (!secret) return;

      if (!quiet) setLoading(true);

      try {
        const response = await fetch(
          "/api/projects",
          {
            headers: {
              "x-editor-password": secret
            },
            cache: "no-store"
          }
        );

        if (response.status === 401) {
          throw new Error(
            "Incorrect access password."
          );
        }

        if (!response.ok) {
          throw new Error(
            "The dashboard could not load Airtable."
          );
        }

        const data = await response.json();

        setProjects(data.projects || []);
        setProjectDate(data.date || "");
        setDailyHours(
          data.dailyHours ?? null
        );
        setWeeklyHours(
          Number(data.weeklyHours) || 0
        );

        if (!hoursDirty.current) {
          setHoursDraft(
            data.dailyHours === null ||
              data.dailyHours === undefined
              ? ""
              : String(data.dailyHours)
          );
        }

        setLastUpdated(new Date());
        setError("");
      } catch (loadError) {
        setError(loadError.message);

        if (
          loadError.message.includes(
            "Incorrect"
          )
        ) {
          window.localStorage.removeItem(
            "skylineEditorPassword"
          );

          window.sessionStorage.removeItem(
            "skylineEditorPassword"
          );

          setPassword("");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!password) return;

    loadProjects(password);

    const timer = window.setInterval(
      () => loadProjects(password, true),
      60000
    );

    return () =>
      window.clearInterval(timer);
  }, [password, loadProjects]);

  async function changeStatus(
    id,
    status,
    secret
  ) {
    const previous = projects;

    setProjects((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status }
          : item
      )
    );

    const response = await fetch(
      `/api/projects/${id}`,
      {
        method: "PATCH",
        headers: {
          "content-type":
            "application/json",
          "x-editor-password": secret
        },
        body: JSON.stringify({ status })
      }
    );

    if (!response.ok) {
      setProjects(previous);

      setError(
        "That status did not save. Please try again."
      );

      throw new Error(
        "Status update failed"
      );
    }

    setError("");
  }

  async function saveHours(event) {
    event.preventDefault();

    const value = Number(hoursDraft);

    if (
      hoursDraft.trim() === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 24
    ) {
      setHoursMessage(
        "Enter a number between 0 and 24."
      );

      return;
    }

    setSavingHours(true);
    setHoursMessage("");

    try {
      const response = await fetch(
        "/api/projects",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            "x-editor-password": password
          },
          body: JSON.stringify({
            hours: value
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The hours did not save."
        );
      }

      hoursDirty.current = false;

      setDailyHours(
        data.dailyHours ?? value
      );

      setWeeklyHours(
        Number(data.weeklyHours) || 0
      );

      setHoursDraft(
        String(data.dailyHours ?? value)
      );

      setHoursMessage("Hours saved");
      setLastUpdated(new Date());
      setError("");
    } catch (saveError) {
      setHoursMessage(
        saveError.message ||
          "The hours did not save."
      );
    } finally {
      setSavingHours(false);
    }
  }

  const counts = useMemo(
    () => ({
      total: projects.length,

      editing: projects.filter(
        (item) =>
          item.status ===
          "Ready for Editing"
      ).length,

      complete: projects.filter(
        (item) =>
          item.status === "Complete"
      ).length
    }),
    [projects]
  );

  function unlock(event) {
    event.preventDefault();

    const value = draftPassword.trim();

    if (!value) return;

    window.localStorage.setItem(
      "skylineEditorPassword",
      value
    );

    setPassword(value);
  }

  function lockDashboard() {
    window.localStorage.removeItem(
      "skylineEditorPassword"
    );

    window.sessionStorage.removeItem(
      "skylineEditorPassword"
    );

    setPassword("");
  }

  if (!password) {
    return (
      <main className="login-shell">
        <form
          className="login-card"
          onSubmit={unlock}
        >
          <div className="brand-mark">S</div>

          <p className="kicker">
            SKYLINE IMAGERY
          </p>

          <h1>Editor Hub</h1>

          <p className="login-copy">
            Enter the private editor
            password to view today's
            projects.
          </p>

          <label>
            Access password

            <input
              type="password"
              value={draftPassword}
              onChange={(event) =>
                setDraftPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              autoFocus
            />
          </label>

          <button type="submit">
            Open Today's Projects
          </button>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}
        </form>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark small">
            S
          </div>

          <div>
            <strong>Skyline</strong>
            <span>Editor Hub</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="live">
            <i /> Live
          </span>

          <button
            className="refresh"
            onClick={() =>
              loadProjects(password)
            }
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </header>

      <div className="dashboard">
        <section className="hero">
          <div>
            <p className="kicker">
              TODAY'S WORKFLOW
            </p>

            <h1>Today's Projects</h1>

            <p className="date">
              {formatProjectDate(projectDate)}
            </p>
          </div>

          <div className="metrics metrics-with-hours">
            <div className="metric-item">
              <strong>{counts.total}</strong>
              <span>Projects</span>
            </div>

            <div className="metric-item">
              <strong>{counts.editing}</strong>
              <span>Editing</span>
            </div>

            <div className="metric-item">
              <strong>{counts.complete}</strong>
              <span>Complete</span>
            </div>

            <form
              className="metric-hours"
              onSubmit={saveHours}
            >
              <label htmlFor="daily-hours">
                Hours
              </label>

              <input
                id="daily-hours"
                type="number"
                min="0"
                max="24"
                step="0.25"
                inputMode="decimal"
                placeholder="0"
                value={hoursDraft}
                disabled={
                  savingHours ||
                  !projects.length
                }
                onChange={(event) => {
                  hoursDirty.current = true;

                  setHoursDraft(
                    event.target.value
                  );

                  setHoursMessage("");
                }}
              />

              <button
                type="submit"
                disabled={
                  savingHours ||
                  !projects.length ||
                  hoursDraft.trim() === ""
                }
              >
                {savingHours ? "..." : "Save"}
              </button>
            </form>

            <div className="metric-item metric-week">
              <strong>
                {formatHours(weeklyHours)}
              </strong>

              <span>Hours This Week</span>
            </div>
          </div>
        </section>

        {hoursMessage && (
          <p
            className={
              hoursMessage === "Hours saved"
                ? "compact-hours-message success"
                : "compact-hours-message"
            }
          >
            {hoursMessage}
          </p>
        )}

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <section
          className="project-list"
          aria-live="polite"
        >
          {loading && !projects.length ? (
            <div className="empty">
              <div className="spinner" />

              <h2>
                Loading today's projects...
              </h2>
            </div>
          ) : projects.length ? (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                password={password}
                onStatusChange={
                  changeStatus
                }
              />
            ))
          ) : (
            <div className="empty">
              <div className="empty-check">
                {"\u2713"}
              </div>

              <h2>
                No active projects today
              </h2>

              <p>
                Anything scheduled later
                will appear here
                automatically.
              </p>
            </div>
          )}
        </section>

        <footer>
          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit"
                  }
                )}`
              : ""}
          </span>

          <button onClick={lockDashboard}>
            Lock dashboard
          </button>
        </footer>
      </div>

      <style jsx global>{`
        .hero {
          align-items: center;
          gap: 28px;
        }

        .metrics.metrics-with-hours {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(88px, 1fr))
            minmax(210px, 1.8fr)
            minmax(125px, 1.15fr);
          align-items: stretch;
          width: min(100%, 820px);
          padding: 0;
          overflow: hidden;
        }

        .metrics-with-hours > * {
          min-width: 0;
          min-height: 84px;
          border-left: 1px solid #dce8ed;
        }

        .metrics-with-hours > *:first-child {
          border-left: 0;
        }

        .metrics-with-hours .metric-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px 10px;
          text-align: center;
        }

        .metrics-with-hours .metric-item strong {
          font-size: clamp(
            1.35rem,
            2vw,
            1.8rem
          );
          line-height: 1;
        }

        .metrics-with-hours .metric-item span,
        .metric-hours label {
          margin-top: 7px;
          color: #607587;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1.15;
          text-transform: uppercase;
        }

        .metric-hours {
          display: grid;
          grid-template-columns:
            auto
            minmax(58px, 78px)
            auto;
          align-content: center;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 12px;
        }

        .metric-hours label {
          margin: 0;
          white-space: nowrap;
        }

        .metric-hours input {
          width: 100%;
          height: 38px;
          margin: 0;
          padding: 0 9px;
          border: 1px solid #cbdde4;
          border-radius: 10px;
          background: #f5fafc;
          color: #06243a;
          font: inherit;
          font-weight: 800;
          text-align: center;
        }

        .metric-hours button {
          height: 38px;
          margin: 0;
          padding: 0 12px;
          border: 0;
          border-radius: 10px;
          background: #169db0;
          color: white;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }

        .metric-hours button:disabled,
        .metric-hours input:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .compact-hours-message {
          width: fit-content;
          margin: -12px 0 16px auto;
          color: #a13f35;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .compact-hours-message.success {
          color: #148563;
        }

        @media (max-width: 1050px) {
          .hero {
            align-items: stretch;
            flex-direction: column;
          }

          .metrics.metrics-with-hours {
            width: 100%;
          }
        }

        @media (max-width: 720px) {
          .metrics.metrics-with-hours {
            grid-template-columns:
              repeat(3, 1fr);
          }

          .metric-hours {
            grid-column: 1 / 3;
            border-top: 1px solid #dce8ed;
            border-left: 0;
          }

          .metrics-with-hours .metric-week {
            grid-column: 3;
            border-top: 1px solid #dce8ed;
          }
        }

        @media (max-width: 480px) {
          .metric-hours {
            grid-template-columns:
              1fr 58px auto;
            padding-inline: 8px;
          }

          .metric-hours label {
            font-size: 0.62rem;
          }
        }
      `}</style>
    </main>
  );
}
