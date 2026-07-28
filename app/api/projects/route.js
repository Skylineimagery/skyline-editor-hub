import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorized(request) {
  const expected = process.env.EDITOR_PASSWORD;
  const supplied = request.headers.get("x-editor-password");
  return Boolean(expected && supplied && supplied === expected);
}

function dateInSavannah() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function normalizeDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
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
  if (!token || !base || !table) throw new Error("Airtable environment variables are missing.");

  const records = [];
  let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${table}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Airtable returned ${response.status}.`);
    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);
  return records;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const today = dateInSavannah();
    const records = await getAllRecords();
    const projects = records
      .filter((record) => normalizeDate(record.fields["Appointment Date"]) === today && !record.fields.Canceled)
      .map((record) => ({
        id: record.id,
        propertyAddress: record.fields["Property Address"] || "",
        customerName: record.fields["Customer Name"] || "",
        orderItems: record.fields["Order Items"] || "",
        customerNotes: record.fields["Customer Notes"] || "",
        skylineNotes: record.fields["Skyline Notes"] || "",
        status: record.fields.Status || "Awaiting Files",
        aryeoOrderLink: record.fields["Aryeo Order Link"] || "",
        fotelloLink: record.fields["Fotello Link"] || "",
        attachments: record.fields.Attachments || []
      }))
      .sort((a, b) => a.propertyAddress.localeCompare(b.propertyAddress));

    return NextResponse.json({ projects, date: today }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
