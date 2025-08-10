import "./globals.css";
export const metadata = { title: "Daily Drops 7-Day" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="container max-w-6xl py-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Daily Drops 7-Day</h1>
            <nav className="space-x-4">
              <a className="underline" href="/">Dashboard</a>
              <a className="underline" href="/settings">Settings</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
