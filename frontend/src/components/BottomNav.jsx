import { NavLink, useLocation } from "react-router-dom";
import { ClockIcon, HomeIcon, UserIcon, UsersIcon, WalletIcon, DiceIcon } from "./Icons.jsx";
import "./BottomNav.css";

const items = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/referral", label: "Referral", icon: UsersIcon },
  { to: "/match-room", label: "Lobby", icon: DiceIcon },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/account", label: "Profile", icon: UserIcon },
];

export default function BottomNav() {
  const location = useLocation();
  const activeIndex = items.findIndex((item) => 
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  return (
    <nav className="bottom-nav">
      {/* Sliding Circle Indicator (Now acts as the sliding FAB background) */}
      <div 
        className="bottom-nav__sliding-wrapper"
        style={{ 
          transform: `translateX(${activeIndex * 100}%)`,
          opacity: activeIndex >= 0 ? 1 : 0 
        }}
      >
        <div className="bottom-nav__sliding-fab">
          <div className="bottom-nav__fab-pulse" />
        </div>
      </div>

      {items.map(({ to, label, icon: Icon, end }, index) => {
        const isActive = activeIndex === index;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={`bottom-nav__item ${isActive ? "is-active" : ""}`}
          >
            <div className="bottom-nav__icon-wrap">
              <Icon size={isActive ? 24 : 21} />
            </div>
            {!isActive && <span className="bottom-nav__label">{label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
