import { useState, useEffect } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import "./BannerSlider.css";

export default function BannerSlider() {
  const { data: apiBanners } = useSWR("/banners");
  const navigate = useNavigate();

  const banners = Array.isArray(apiBanners) ? apiBanners : [];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const handleBannerClick = (banner) => {
    if (!banner.linkUrl) return;
    if (banner.linkUrl.startsWith("http")) {
      window.open(banner.linkUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate(banner.linkUrl);
    }
  };

  const currentBanner = banners[currentIndex] || banners[0];

  return (
    <div className="banner-slider-container">
      <div
        className="banner-slide"
        key={currentBanner._id || currentIndex}
        onClick={() => handleBannerClick(currentBanner)}
        style={{ cursor: currentBanner.linkUrl ? "pointer" : "default" }}
      >
        <img src={currentBanner.imageUrl} alt={currentBanner.title || "Banner"} className="banner-image" />
      </div>

      {banners.length > 1 && (
        <div className="banner-dots">
          {banners.map((_, idx) => (
            <span
              key={idx}
              className={`banner-dot ${idx === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
