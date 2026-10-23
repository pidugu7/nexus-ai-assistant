import { NAV_ITEMS, useNavStore } from "../store/navStore.js";

export function LeftNav() {
  const { active, setActive } = useNavStore();

  return (
    <nav className="leftnav" aria-label="Primary" data-testid="leftnav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item}
          role="tab"
          aria-selected={active === item}
          tabIndex={0}
          className={`nav-item ${active === item ? "nav-item-active" : ""}`}
          onClick={() => setActive(item)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActive(item);
            }
          }}
          data-testid={`nav-${item.toLowerCase()}`}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
