import { useEffect, useState } from "react";

const TARGET = new Date("2026-10-12T00:00:00-07:00").getTime();

const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");

export const Countdown = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = Math.max(0, TARGET - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const units: Array<[string, string]> = [
    ["Days", pad(days)],
    ["Hours", pad(hours)],
    ["Minutes", pad(minutes)],
    ["Seconds", pad(seconds)],
  ];

  return (
    <div className="countdown-box">
      <span className="countdown-label">Applications open in</span>
      <div className="countdown-units">
        {units.map(([label, value]) => (
          <div className="countdown-unit" key={label}>
            <span className="countdown-value">{value}</span>
            <span className="countdown-unit-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Countdown;
