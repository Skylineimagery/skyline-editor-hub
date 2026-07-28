# Skyline Editor Hub

Private, live editor dashboard powered by Airtable and deployed through Vercel.

## Required Vercel environment variables

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_ID`
- `EDITOR_PASSWORD`

The dashboard shows only records whose Appointment Date is today in the
America/New_York timezone and whose Canceled checkbox is unchecked.
