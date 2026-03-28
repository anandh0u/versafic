import { MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${compact ? 'h-11 px-4' : 'px-4 py-3'}`}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="theme-toggle-icon">
        {isLight ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
      </span>
      <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}
