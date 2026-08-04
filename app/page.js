"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const STATUS_OPTIONS = [
  "Awaiting Files",
  "Ready for Editing",
  "Complete"
];

const STATUS_LABELS = {
  "Awaiting Files": "Awaiting Files",
  "Ready for Editing": "Editing",
  Complete: "Complete"
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

  const packageInfo = PACKAGE_DETAILS.find((item) =>
    item.pattern.test(text)
  );

  return {
    text,
    packageInfo
  };
}

function StatusPill({ value, onChange, saving }) {
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
        onChange={(event) => onChange(event.target.value)}
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

function AttachmentGallery({ attachments = [], onSelect }) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="attachments">
      {attachments.map((file, index) => (
        <button
          className="attachment"
          key={file.id || file.url}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Open ${
            file.filename || `attachment ${index + 1}`
          }`}
        >
          {file.type?.startsWith("image/") ? (
            <img
              src={file.thumbnails?.large?.url || file.url}
              alt={
                file.filename ||
                `Project attachment ${index + 1}`
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
    selectedAttachmentIndex,
    setSelectedAttachmentIndex
  ] = useState(null);

  const attachments = Array.isArray(project.attachments)
    ? project.attachments
    : [];

  const selectedAttachment =
    selectedAttachmentIndex !== null
      ? attachments[selectedAttachmentIndex]
      : null;

  const orderItems = parseOrderItems(
    project.orderItems
  );

  const hasAlert = Boolean(
    project.customerNotes || project.skylineNotes
  );

  const closeAttachment = useCallback(() => {
    setSelectedAttachmentIndex(null);
  }, []);

  const showPreviousAttachment = useCallback(() => {
    if (!attachments.length) {
      return;
    }

    setSelectedAttachmentIndex((current) => {
      if (current === null) {
        return 0;
      }

      return (
        current -
        1 +
        attachments.length
      ) % attachments.length;
    });
  }, [attachments.length]);

  const showNextAttachment = useCallback(() => {
    if (!attachments.length) {
      return;
    }

    setSelectedAttachmentIndex((current) => {
      if (current === null) {
        return 0;
      }

      return (current + 1) % attachments.length;
    });
  }, [attachments.length]);

  useEffect(() => {
    if (selectedAttachmentIndex === null) {
      return;
    }

    const previousHtmlOverflow =
      document.documentElement.style.overflow;

    const previousBodyOverflow =
      document.body.style.overflow;

    document.documentElement.style.overflow =
      "hidden";

    document.body.style.overflow = "hidden";

    function handleLightboxKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAttachment();
        return;
      }

      if (
        event.key === "ArrowLeft" &&
        attachments.length > 1
      ) {
        event.preventDefault();
        showPreviousAttachment();
        return;
      }

      if (
        event.key === "ArrowRight" &&
        attachments.length > 1
      ) {
        event.preventDefault();
        showNextAttachment();
      }
    }

    window.addEventListener(
      "keydown",
      handleLightboxKeydown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleLightboxKeydown
      );

      document.documentElement.style.overflow =
        previousHtmlOverflow;

      document.body.style.overflow =
        previousBodyOverflow;
    };
  }, [
    selectedAttachmentIndex,
    attachments.length,
    closeAttachment,
    showPreviousAttachment,
    showNextAttachment
  ]);

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
        type="button"
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
            ⌄
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
                      {orderItems.packageInfo.name}
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
            Open Aryeo ↗
          </a>
        )}

        {project.fotelloLink && (
          <a
            className="link-button"
            href={project.fotelloLink}
            target="_blank"
            rel="noreferrer"
          >
            Open Fotello ↗
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
              <h3>Customer / Order Notes</h3>

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
            attachments={attachments}
            onSelect={
              setSelectedAttachmentIndex
            }
          />
        </div>
      )}

      {selectedAttachment &&
        createPortal(
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Project attachment viewer"
          >
            <button
              className="lightbox-backdrop"
              type="button"
              onClick={closeAttachment}
              aria-label="Close attachment"
            />

            <div className="lightbox-content">
              <button
                className="lightbox-close"
                type="button"
                onClick={closeAttachment}
                aria-label="Close attachment"
              >
                ×
              </button>

              {attachments.length > 1 && (
                <>
                  <button
                    className="lightbox-arrow lightbox-arrow-left"
                    type="button"
                    onClick={
                      showPreviousAttachment
                    }
                    aria-label="Previous attachment"
                  >
                    ‹
                  </button>

                  <button
                    className="lightbox-arrow lightbox-arrow-right"
                    type="button"
                    onClick={showNextAttachment}
                    aria-label="Next attachment"
                  >
                    ›
                  </button>
                </>
              )}

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
                  <a
                    href={selectedAttachment.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open attachment
                  </a>
                )}
              </div>

              <div className="lightbox-caption">
                {selectedAttachment.filename && (
                  <p>
                    {selectedAttachment.filename}
                  </p>
                )}

                {attachments.length > 1 && (
                  <span>
                    {selectedAttachmentIndex + 1} of{" "}
                    {attachments.length}
                  </span>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </article>
  );
}

function HoursControl({
  hours,
  weeklyHours,
  onSave,
  saving
}) {
  const [draftHours, setDraftHours] = useState(
    hours === null ||
      hours === undefined ||
      hours === ""
      ? ""
      : String(hours)
  );

  useEffect(() => {
    setDraftHours(
      hours === null ||
        hours === undefined ||
        hours === ""
        ? ""
        : String(hours)
    );
  }, [hours]);

  function submitHours(event) {
    event.preventDefault();

    const parsed =
      draftHours === ""
        ? 0
        : Number(draftHours);

    if (
      Number.isNaN(parsed) ||
      parsed < 0 ||
      parsed > 24
    ) {
      return;
    }

    onSave(parsed);
  }

  return (
    <form
      className="hours-inline"
      onSubmit={submitHours}
    >
      <label className="hours-input-group">
        <span>Hour</span>

        <input
          type="number"
          min="0"
          max="24"
          step="0.25"
          inputMode="decimal"
          value={draftHours}
          onChange={(event) =>
            setDraftHours(event.target.value)
          }
          aria-label="Hours worked today"
        />
      </label>

      <button
        type="submit"
        className="save-hours"
        disabled={saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <div className="weekly-hours">
        <strong>{weeklyHours || 0}</strong>
        <span>Hours this week</span>
      </div>
    </form>
  );
}

export default function Home() {
  const [password, setPassword] = useState("");
  const [draftPassword, setDraftPassword] =
    useState("");

  const [projects, setProjects] = useState([]);
  const [projectDate, setProjectDate] =
    useState("");

  const [hours, setHours] = useState("");
  const [weeklyHours, setWeeklyHours] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [savingHours, setSavingHours] =
    useState(false);

  const [error, setError] = useState("");
  const [hoursMessage, setHoursMessage] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "skylineEditorPassword"
    );

    if (saved) {
      setPassword(saved);
    }
  }, []);

  const loadProjects = useCallback(
    async (secret, quiet = false) => {
      if (!secret) {
        return;
      }

      if (!quiet) {
        setLoading(true);
      }

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
        setHours(data.hours ?? "");
        setWeeklyHours(data.weeklyHours ?? 0);
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

          setPassword("");
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!password) {
      return;
    }

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
          ? {
              ...item,
              status
            }
          : item
      )
    );

    const response = await fetch(
      `/api/projects/${id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-editor-password": secret
        },
        body: JSON.stringify({
          status
        })
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

  async function saveHours(value) {
    setSavingHours(true);
    setHoursMessage("");

    try {
      const response = await fetch(
        "/api/hours",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-editor-password": password
          },
          body: JSON.stringify({
            date: projectDate,
            hours: value
          })
        }
      );

      if (response.status === 401) {
        throw new Error(
          "Incorrect access password."
        );
      }

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.error ||
            "The hours did not save."
        );
      }

      const data = await response.json();

      setHours(data.hours ?? value);
      setWeeklyHours(
        data.weeklyHours ?? weeklyHours
      );

      setHoursMessage("Saved");
      setError("");
    } catch (saveError) {
      setError(saveError.message);
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

    if (!value) {
      return;
    }

    window.localStorage.setItem(
      "skylineEditorPassword",
      value
    );

    setPassword(value);
  }

  function displayedDate() {
    if (!projectDate) {
      return new Date();
    }

    const [
      year,
      month,
      day
    ] = projectDate
      .split("-")
      .map(Number);

    return new Date(
      year,
      month - 1,
      day,
      12
    );
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
            Enter the private editor password
            to view today’s projects.
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
            Open Today’s Projects
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
            <i />
            Live
          </span>

          <button
            className="refresh"
            type="button"
            onClick={() =>
              loadProjects(password)
            }
            disabled={loading}
          >
            {loading
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </div>
      </header>

      <div className="dashboard">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">
              TODAY’S WORKFLOW
            </p>

            <h1>Today’s Projects</h1>

            <p className="date">
              {new Intl.DateTimeFormat(
                "en-US",
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                }
              ).format(displayedDate())}
            </p>
          </div>

          <div className="hero-controls">
            <div className="metrics">
              <div>
                <strong>
                  {counts.total}
                </strong>
                <span>Projects</span>
              </div>

              <div>
                <strong>
                  {counts.editing}
                </strong>
                <span>Editing</span>
              </div>

              <div>
                <strong>
                  {counts.complete}
                </strong>
                <span>Complete</span>
              </div>
            </div>

            <HoursControl
              hours={hours}
              weeklyHours={weeklyHours}
              onSave={saveHours}
              saving={savingHours}
            />

            {hoursMessage && (
              <span className="hours-message">
                {hoursMessage}
              </span>
            )}
          </div>
        </section>

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
                Loading today’s projects…
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
                ✓
              </div>

              <h2>
                No active projects today
              </h2>

              <p>
                Anything scheduled later will
                appear here automatically.
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

          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(
                "skylineEditorPassword"
              );

              setPassword("");
            }}
          >
            Lock dashboard
          </button>
        </footer>
      </div>
    </main>
  );
}
