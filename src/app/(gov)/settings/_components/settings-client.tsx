"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Type,
  Eye,
  Bell,
  Contrast,
  Languages,
  RotateCcw,
  CheckCircle2,
  Accessibility,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "~/app/_components/UI/Card";

// ─── Types ────────────────────────────────────────────────────────────────────

type FontSize = "sm" | "md" | "lg" | "xl";
type ContrastMode = "normal" | "high";

interface Settings {
  fontSize: FontSize;
  contrast: ContrastMode;
  reduceMotion: boolean;
  notifications: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: "md",
  contrast: "normal",
  reduceMotion: false,
  notifications: true,
};

const STORAGE_KEY = "aquavalley:settings:v2";

// ─── Apply settings to the DOM immediately ────────────────────────────────────

function applyToDom(s: Settings) {
  const html = document.documentElement;

  // Font size — data attribute drives rem overrides in globals.css
  html.setAttribute("data-font-size", s.fontSize);

  // Contrast
  html.setAttribute("data-contrast", s.contrast);

  // Reduce motion
  html.setAttribute("data-reduce-motion", String(s.reduceMotion));
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function saveToStorage(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount & apply
  useEffect(() => {
    const stored = loadFromStorage();
    setSettings(stored);
    applyToDom(stored);
    setLoaded(true);
  }, []);

  // Clear flash timer on unmount to avoid setState after unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      // Apply live preview immediately (before saving)
      applyToDom(next);
      return next;
    });
  }, []);

  const save = useCallback((s: Settings) => {
    saveToStorage(s);
    applyToDom(s);
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    setSavedFlash(true);
    flashTimerRef.current = setTimeout(() => setSavedFlash(false), 2500);
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    applyToDom(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, save, reset, savedFlash, loaded };
}

// ─── Toggle Switch (properly RTL-aware) ───────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
        checked ? "bg-sky-500" : "bg-gray-200"
      }`}
    >
      <span className="sr-only">{checked ? "مفعّل" : "معطّل"}</span>
      {/* Thumb — moves LEFT when checked because RTL layout */}
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "-translate-x-6" : "-translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── Pill Group ───────────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
              active
                ? "border-sky-400 bg-sky-500/10 text-sky-600 shadow-sm ring-1 ring-sky-400/40"
                : "border-[var(--color-border-card)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:border-sky-300 hover:text-sky-500"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Section Row ─────────────────────────────────────────────────────────────

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-[var(--color-border)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--color-text)]">{title}</div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SettingsClient() {
  const { settings, update, save, reset, savedFlash, loaded } = useSettings();

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }


  const fontOptions: { value: FontSize; label: string; icon?: React.ReactNode }[] = [
    { value: "sm", label: "صغير" },
    { value: "md", label: "متوسط" },
    { value: "lg", label: "كبير" },
    { value: "xl", label: "أكبر" },
  ];

  const contrastOptions: { value: ContrastMode; label: string; icon?: React.ReactNode }[] = [
    { value: "normal", label: "عادي" },
    { value: "high", label: "تباين عالٍ" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6 lg:p-8" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 border-b border-[var(--color-border)] pb-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/20 to-blue-600/20 ring-1 ring-sky-400/25">
          <Accessibility size={22} className="text-sky-500" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">الإعدادات</h1>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          تخصيص إمكانية الوصول — تُطبَّق فوراً ويجب حفظها يدوياً
          </p>
        </div>
      </div>

      {/* ── Appearance ── */}
      <Card>
        <CardHeader>
          <CardTitle>إمكانية الوصول</CardTitle>
        </CardHeader>
        <CardBody>
          {/* Font size */}
          <SettingRow
            icon={<Type size={16} />}
            title="حجم الخط"
            description="غيّر حجم النص في جميع أنحاء التطبيق"
          >
            <PillGroup
              value={settings.fontSize}
              onChange={(v) => update("fontSize", v)}
              options={fontOptions}
            />
            {/* Live preview */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-muted)]">
              معاينة:{" "}
              <span className="font-bold text-[var(--color-text)]">
                هذا نص تجريبي لمعاينة حجم الخط المختار
              </span>
            </div>
          </SettingRow>

          {/* Contrast */}
          <SettingRow
            icon={<Contrast size={16} />}
            title="مستوى التباين"
            description="التباين العالي يُسهّل قراءة المحتوى لمستخدمي ضعف البصر"
          >
            <PillGroup
              value={settings.contrast}
              onChange={(v) => update("contrast", v)}
              options={contrastOptions}
            />
          </SettingRow>

          {/* Reduce motion */}
          <SettingRow
            icon={<Eye size={16} />}
            title="تقليل الحركة"
            description="تعطيل الرسوم المتحركة والانتقالات لمن يعانون من حساسية الحركة"
          >
            <label htmlFor="toggle-motion" className="flex cursor-pointer items-center gap-3">
              <Toggle
                id="toggle-motion"
                checked={settings.reduceMotion}
                onChange={(v) => update("reduceMotion", v)}
              />
              <span className="text-sm text-[var(--color-text)]">
                {settings.reduceMotion
                  ? "مُفعَّل — الرسوم المتحركة مُقلَّلة"
                  : "معطَّل — الرسوم المتحركة مُفعَّلة"}
              </span>
            </label>
          </SettingRow>
        </CardBody>
      </Card>

      {/* ── Language ── */}
      <Card>
        <CardHeader>
          <CardTitle>اللغة والمنطقة</CardTitle>
        </CardHeader>
        <CardBody>
          <SettingRow
            icon={<Languages size={16} />}
            title="لغة الواجهة"
            description="اللغة المعروضة حالياً في النظام"
          >
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <span className="text-xl">🇸🇦</span>
              <div>
                <div className="text-sm font-bold text-[var(--color-text)]">العربية</div>
                <div className="text-xs text-[var(--color-muted)]">
                  اللغة الافتراضية للنظام — لا يمكن تغييرها حالياً
                </div>
              </div>
            </div>
          </SettingRow>
        </CardBody>
      </Card>

      {/* ── Notifications ── */}
      <Card>
        <CardHeader>
          <CardTitle>الإشعارات</CardTitle>
        </CardHeader>
        <CardBody>
          <SettingRow
            icon={<Bell size={16} />}
            title="إشعارات التنبيهات الحرجة"
            description="تنبيهات فورية عند اكتشاف تجاوزات أو أعطال في منظومة المياه"
          >
            <label htmlFor="toggle-notif" className="flex cursor-pointer items-center gap-3">
              <Toggle
                id="toggle-notif"
                checked={settings.notifications}
                onChange={(v) => update("notifications", v)}
              />
              <span className="text-sm text-[var(--color-text)]">
                {settings.notifications
                  ? "مُفعَّل — ستتلقى إشعارات التنبيهات"
                  : "معطَّل — لن تتلقى أي إشعارات"}
              </span>
            </label>
          </SettingRow>
        </CardBody>
      </Card>

      {/* ── Actions ── */}
      <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center pb-4">
        <button
          type="button"
          onClick={reset}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--color-muted)] transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        >
          <RotateCcw size={14} />
          إعادة الضبط الافتراضي
        </button>

        <button
          type="button"
          onClick={() => save(settings)}
          className={`flex items-center justify-center gap-2 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-200 ${
            savedFlash
              ? "bg-emerald-500 shadow-emerald-200"
              : "bg-blue-500 hover:bg-blue-600 shadow-blue-200"
          }`}
        >
          {savedFlash ? (
            <>
              <CheckCircle2 size={16} />
              تم الحفظ!
            </>
          ) : (
            "حفظ الإعدادات"
          )}
        </button>
      </div>
    </div>
  );
}
