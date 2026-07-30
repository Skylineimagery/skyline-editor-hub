import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorized(request) {
  const expected = process.env.EDITOR_PASSWORD;
  const supplied = request.headers.get("x-editor-password");

  return Boolean(
    expected &&
    supplied &&
    supplied === expected
  );
}

/*
  Skyline's operational day changes at 6:00 PM Eastern.

  Before 6:00 PM:
  Show yesterday's appointments.

  At or after 6:00 PM:
  Show today's appointments.
*/
function activeProjectDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));

  if (hour >= 18) {
    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  const previousDate = new Date(
    Date.UTC(year, month - 1, day - 1)
  );

  return previousDate.toISOString().slice(0, 10);
}

function normalizeDate(value) {
  if (!value) return "";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}

function getWeekRange(dateString) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const dayOfWeek = date.getUTCDay();

  // Sunday is 0, so move it back six days.
  const daysSinceMonday =
    dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(date);
  monday.setUTCDate(
    monday.getUTCDate() - daysSinceMonday
  );

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10)
  };
}

function airtableSettings() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_ID;

  if (!token || !base || !table) {
    throw new Error(
      "Airtable environment variables are missing."
    );
  }

  return { token, base, table };
}

async function getAllRecords() {
  const { token, base, table } =
    airtableSettings();

  const records = [];
  let offset = "";

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${base}/${table}`
    );

    url.searchParams.set("pageSize", "100");

    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Airtable returned ${response.status}.`
      );
    }

    const data = await response.json();

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records;
}

async function updateRecord(recordId, fields) {
  const { token, base, table } =
    airtableSettings();

  const response = await fetch(
    `https://api.airtable.com/v0/${base}/${table}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Airtable update returned ${response.status}: ${details}`
    );
  }

  return response.json();
}

function calculateHours(records, projectDate) {
  const { weekStart, weekEnd } =
    getWeekRange(projectDate);

  /*
    Only one hours value is counted per appointment date,
    even if a date contains several projects.
  */
  const hoursByDate = new Map();

  for (const record of records) {
    if (record.fields.Canceled) continue;

    const appointmentDate = normalizeDate(
      record.fields["Appointment Date"]
    );

    if (
      !appointmentDate ||
      appointmentDate < weekStart ||
      appointmentDate > weekEnd
    ) {
      continue;
    }

    const value = Number(
      record.fields["Editor Hours"]
    );

    if (
      Number.isFinite(value) &&
      value >= 0 &&
      !hoursByDate.has(appointmentDate)
    ) {
      hoursByDate.set(appointmentDate, value);
    }
  }

  const dailyHours =
    hoursByDate.get(projectDate) ?? null;

  const weeklyHours = Array.from(
    hoursByDate.values()
  ).reduce((total, hours) => total + hours, 0);

  return {
    dailyHours,
    weeklyHours,
    weekStart,
    weekEnd
  };
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const projectDate = activeProjectDate();
    const records = await getAllRecords();

    const projects = records
      .filter(
        (record) =>
          normalizeDate(
            record.fields["Appointment Date"]
          ) === projectDate &&
          !record.fields.Canceled
      )
      .map((record) => ({
        id: record.id,
        propertyAddress:
          record.fields["Property Address"] || "",
        customerName:
          record.fields["Customer Name"] || "",
        orderItems:
          record.fields["Order Items"] || "",
        customerNotes:
          record.fields["Customer Notes"] || "",
        skylineNotes:
          record.fields["Skyline Notes"] || "",
        status:
          record.fields.Status || "Awaiting Files",
        aryeoOrderLink:
          record.fields["Aryeo Order Link"] || "",
        fotelloLink:
          record.fields["Fotello Link"] || "",
        attachments:
          record.fields.Attachments || []
      }))
      .sort((a, b) =>
        a.propertyAddress.localeCompare(
          b.propertyAddress
        )
      );

    const hours = calculateHours(
      records,
      projectDate
    );

    return NextResponse.json(
      {
        projects,
        date: projectDate,
        ...hours
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const hours = Number(body.hours);

    if (
      !Number.isFinite(hours) ||
      hours < 0 ||
      hours > 24
    ) {
      return NextResponse.json(
        {
          error:
            "Hours must be a number between 0 and 24."
        },
        { status: 400 }
      );
    }

    const projectDate = activeProjectDate();
    const records = await getAllRecords();

    const todaysRecords = records.filter(
      (record) =>
        normalizeDate(
          record.fields["Appointment Date"]
        ) === projectDate &&
        !record.fields.Canceled
    );

    if (todaysRecords.length === 0) {
      return NextResponse.json(
        {
          error:
            "There are no active projects available for this date."
        },
        { status: 400 }
      );
    }

    /*
      Continue using the record that already contains
      today's hours. Otherwise, use the first project.
    */
    const hoursRecord =
      todaysRecords.find(
        (record) =>
          record.fields["Editor Hours"] !==
            undefined &&
          record.fields["Editor Hours"] !== null
      ) || todaysRecords[0];

    await updateRecord(hoursRecord.id, {
      "Editor Hours": hours
    });

    /*
      Clear accidental duplicate hour entries from any
      other projects on the same date.
    */
    const duplicateRecords = todaysRecords.filter(
      (record) =>
        record.id !== hoursRecord.id &&
        record.fields["Editor Hours"] !==
          undefined &&
        record.fields["Editor Hours"] !== null
    );

    await Promise.all(
      duplicateRecords.map((record) =>
        updateRecord(record.id, {
          "Editor Hours": null
        })
      )
    );

    const refreshedRecords = await getAllRecords();
    const totals = calculateHours(
      refreshedRecords,
      projectDate
    );

    return NextResponse.json(
      {
        success: true,
        date: projectDate,
        ...totals
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
