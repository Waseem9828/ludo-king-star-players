import { useState, useEffect } from "react";
import useSWR from "swr";
import "./NewsTicker.css";

const fallbackNotices = [
  { text: "Withdrawals are processing instantly via Automatic Gateway.", dateTag: "Today" },
  { text: "Complete 12-digit Aadhaar KYC to unlock instant payouts.", dateTag: "30 Aug 2026" },
  { text: "Refer friends and earn 2% lifetime commission chips!", dateTag: "29 Aug 2026" },
  { text: "Welcome to ludo King adda .com — India's top Ludo gaming platform.", dateTag: "Notice" },
];

export default function NewsTicker() {
  const { data: noticesData } = useSWR("/settings/notices");
  const notices = (noticesData && noticesData.length > 0) ? noticesData : fallbackNotices;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (notices.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % notices.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [notices.length, isPaused]);

  const currentNotice = notices[currentIndex] || notices[0];

  return (
    <div
      className="animated-notice-bar"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="notice-content-wrapper" key={currentIndex}>
        <span className="notice-text">
          {currentNotice.text}
        </span>
      </div>
    </div>
  );
}

