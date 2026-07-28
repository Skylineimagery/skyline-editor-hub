import { NextResponse } from "next/server";

const ALLOWED = new Set(["Awaiting Files", "Ready for Editing", "Complete"]);

function authorized(request) {
  const expected = process.env.EDITOR_PASSWORD;
  const supplied = request.headers.get("x-editor-password");
  return Boolean(expected && supplied && supplied === expected);
}

export async function PATCH(request, context) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { status } = await request.json();
  if (!ALLOWED.has(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (!/^rec[a-zA-Z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid record" }, { status: 400 });

  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_ID;
  if (!token || !base || !table) {
    return NextResponse.json({ error: "Airtable environment variables are missing." }, { status: 500 });
  }

  const response = await fetch(`https://api.airtable.com/v0/${base}/${table}/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: { Status: status } })
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: response.status });
  }

  return NextResponse.json({ ok: true });
}
