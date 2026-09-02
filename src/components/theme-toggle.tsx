import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="group relative grid size-9 place-items-center overflow-hidden rounded-md border border-border/70 bg-card/50 text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:text-foreground active:scale-90"
    >
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-primary/10" />
      {isDark ? (
        <Moon key="moon" className="theme-icon-enter relative h-4 w-4" />
      ) : (
        <Sun key="sun" className="theme-icon-enter relative h-4 w-4" />
      )}
    </button>
  );
}
