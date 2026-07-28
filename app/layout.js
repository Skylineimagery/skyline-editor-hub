import "./globals.css";

export const metadata = {
  title: "Skyline Editor Hub",
  description: "Today's Skyline Imagery editing projects"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
