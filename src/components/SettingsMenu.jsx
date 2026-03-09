import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Settings, Sun, Moon, Monitor, Rows3, LayoutDashboard } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsMenu() {
  const { theme, compact, updateSetting } = useTheme();

  return (
    <Popover className="relative">
      <PopoverButton className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition focus:outline-none">
        <Settings className="h-3.5 w-3.5" />
        Settings
      </PopoverButton>

      <PopoverPanel
        anchor="bottom end"
        className="z-50 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl shadow-black/20 animate-fade-in"
      >
        {/* ── Theme ────────────────────────────── */}
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Theme
          </h3>
          <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => updateSetting("theme", value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  theme === value
                    ? "bg-slate-700 text-slate-100 shadow-sm"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── View Mode ────────────────────────── */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            View Mode
          </h3>
          <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1">
            <button
              onClick={() => updateSetting("compact", false)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                !compact
                  ? "bg-slate-700 text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <Rows3 className="h-3.5 w-3.5" />
              Full Detail
            </button>
            <button
              onClick={() => updateSetting("compact", true)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                compact
                  ? "bg-slate-700 text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              At a Glance
            </button>
          </div>
        </div>
      </PopoverPanel>
    </Popover>
  );
}
