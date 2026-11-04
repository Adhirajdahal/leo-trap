import './globals.css';

export const metadata = {
  title: 'Leo Trap Online — Live Multiplayer & Betting',
  description: 'Real-time Tigers vs Goats with wagered challenges.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="footer">
          👤 Author: <b>SP</b> · 📱 <b>9851052369</b> · 🏢 <b>Techno &amp; Z Company</b>
        </footer>
      </body>
    </html>
  );
}
