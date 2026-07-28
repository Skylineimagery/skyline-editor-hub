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

  // At 6:00 PM Eastern, begin showing today's appointments.
  if (hour >= 18) {
    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  // Before 6:00 PM Eastern, continue showing yesterday's appointments.
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

async function getAllRecords() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_ID;

  if (!token || !base || !table) {
    throw new Error(
      "Airtable environment variables are missing."
    );
  }

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

    return NextResponse.json(
      {
        projects,
        date: projectDate
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
