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
  User,
  Phone,
  Save,
  AlertCircle,
  BellOff,
  BellRing,
} from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Card, CardHeader, CardTitle, CardBody } from "~/app/_components/UI/Card";
import { Button } from "~/app/_components/UI/Button";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { api } from "~/trpc/react";
import { springs, variants, tapFeedback } from "~/lib/motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type FontSize = "sm" | "md" | "lg" | "xl";
type ContrastMode = "normal" | "high";
type TabId = "accessibility" | "notifications" | "profile";

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

// ─── Apply settings to DOM ────────────────────────────────────────────────────

function applyToDom(s: Settings) {
  const html = document.documentElement;
  html.setAttribute("data-font-size", s.fontSize);
  html.setAttribute("data-contrast", s.contrast);
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

  useEffect(() => {
    const stored = loadFromStorage();
    setSettings(stored);
    applyToDom(stored);
    setLoaded(true);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
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

// ─── Toggle Switch ────────────────────────────────────────────────────────────

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
      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        checked ? "bg-blue-500" : "bg-slate-200"
      }`}
    >
      <span className="sr-only">{checked ? "مفعّل" : "معطّل"}</span>
      <motion.span
        layout
        transition={springs.snappy}
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 ${
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
          <motion.button
            key={opt.value}
            type="button"
            whileHover={{ y: -1 }}
            whileTap={tapFeedback}
            onClick={() => onChange(opt.value)}
            aria-selected={active}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
              active
                ? "border-blue-500 bg-blue-50/50 text-blue-600 ring-1 ring-blue-500/20"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {opt.icon}
            {opt.label}
            {active && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-extrabold text-white">
                ✓
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Setting Row ─────────────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-slate-100">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">{title}</div>
          <div className="mt-0.5 text-xs text-slate-400">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "accessibility", label: "إمكانية الوصول", icon: <Accessibility size={16} /> },
  { id: "notifications", label: "الإشعارات", icon: <Bell size={16} /> },
  { id: "profile", label: "الملف الشخصي", icon: <User size={16} /> },
];

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading, error } = api.users.getProfile.useQuery();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPristine, setIsPristine] = useState(true);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only sync profile to form when pristine (not editing)
  useEffect(() => {
    if (profile && isPristine) {
      setFullName(profile.fullName ?? "");
      setPhone(profile.phoneNumber ?? "");
    }
  }, [profile, isPristine]);

  // Cleanup feedback timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const updateMutation = api.users.updateProfile.useMutation({
    onSuccess: () => {
      setFeedback({ type: "success", msg: "تم تحديث ملفك الشخصي بنجاح" });
      setIsPristine(true);
      // Clear existing timer before setting new one
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
        feedbackTimerRef.current = null;
      }, 3000);
    },
    onError: (err) => {
      setFeedback({ type: "error", msg: err.message || "فشل تحديث الملف الشخصي" });
    },
  });

  const handleSave = () => {
    setFeedback(null);
    updateMutation.mutate({ fullName: fullName.trim() || undefined, phone: phone.trim() || undefined });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4"
      >
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold text-red-800">خطأ في تحميل الملف الشخصي</p>
          <p className="mt-1 text-sm text-red-700">يرجى محاولة إعادة تحميل الصفحة</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingRow
        icon={<User size={16} />}
        title="الاسم الكامل"
        description="اسمك كما يظهر للآخرين في النظام"
      >
        <label htmlFor="fullname-input" className="sr-only">
          الاسم الكامل
        </label>
        <input
          id="fullname-input"
          type="text"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setIsPristine(false);
          }}
          placeholder="أدخل اسمك الكامل"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
        />
      </SettingRow>

      <SettingRow
        icon={<Phone size={16} />}
        title="رقم الجوال"
        description="رقم التواصل الخاص بحسابك"
      >
        <label htmlFor="phone-input" className="sr-only">
          رقم الجوال
        </label>
        <input
          id="phone-input"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setIsPristine(false);
          }}
          placeholder="05xxxxxxxx"
          dir="ltr"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
        />
      </SettingRow>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-sm font-semibold ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50/50 text-red-800"
                : "border-emerald-200 bg-emerald-50/50 text-emerald-800"
            }`}
          >
            {feedback.type === "error" ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            )}
            <span>{feedback.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-start pt-2">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="rounded-xl px-6 py-2.5 font-bold"
          icon={<Save className="h-4 w-4" />}
        >
          {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SettingsClient() {
  const { settings, update, save, reset, savedFlash, loaded } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>("accessibility");

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const fontOptions: { value: FontSize; label: string }[] = [
    { value: "sm", label: "صغير" },
    { value: "md", label: "متوسط" },
    { value: "lg", label: "كبير" },
    { value: "xl", label: "أكبر" },
  ];

  const contrastOptions: { value: ContrastMode; label: string }[] = [
    { value: "normal", label: "عادي" },
    { value: "high", label: "تباين عالٍ" },
  ];

  return (
    <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "never"}>
      <motion.div
        initial="hidden"
        animate="show"
        variants={variants.staggerContainer}
        className="mx-auto max-w-3xl space-y-6 p-4 md:p-6"
        dir="rtl"
      >
      {/* ── Page Header ── */}
      <motion.div variants={variants.fadeSlideUp} className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400/20 to-blue-600/20 ring-1 ring-blue-400/20">
          <Accessibility size={22} className="text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl">
            الإعدادات
          </h1>
          <p className="mt-0.5 text-sm font-semibold text-slate-400">
            تخصيص تجربتك — تُطبَّق التغييرات فوراً
          </p>
        </div>
      </motion.div>

      {/* ── Tab Bar ── */}
      <motion.div variants={variants.fadeSlideUp}>
        {/* Mobile: horizontal scroll, Desktop: flex row */}
        <div className="relative flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 p-1.5 scrollbar-hide" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                whileTap={tapFeedback}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap z-10 ${
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className={isActive ? "text-blue-600" : "text-slate-400"}>
                  {tab.icon}
                </span>
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 rounded-xl bg-white shadow-sm -z-10"
                    transition={springs.silk}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Tab Content ── */}
      <motion.div variants={variants.fadeSlideUp}>
        <AnimatePresence mode="wait">
          {activeTab === "accessibility" && (
            <motion.div
              key="accessibility"
              id="tabpanel-accessibility"
              role="tabpanel"
              aria-labelledby="tab-accessibility"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={variants.fadeSlideUp}
            >
              <Card className="border border-slate-100 shadow-md overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-50 p-1.5">
                      <Accessibility className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>إمكانية الوصول</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="p-6">
                  {/* Font Size */}
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
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-slate-500 text-xs">
                      معاينة:{" "}
                      <span className="font-bold text-slate-800">
                        هذا نص تجريبي لمعاينة حجم الخط المختار
                      </span>
                    </div>
                  </SettingRow>

                  {/* Contrast */}
                  <SettingRow
                    icon={<Contrast size={16} />}
                    title="مستوى التباين"
                    description="التباين العالي يُسهّل القراءة لمستخدمي ضعف البصر"
                  >
                    <PillGroup
                      value={settings.contrast}
                      onChange={(v) => update("contrast", v)}
                      options={contrastOptions}
                    />
                  </SettingRow>

                  {/* Reduce Motion */}
                  <SettingRow
                    icon={<Eye size={16} />}
                    title="تقليل الحركة"
                    description="تعطيل الرسوم المتحركة لمن يعانون من حساسية الحركة"
                  >
                    <label htmlFor="toggle-motion" className="flex cursor-pointer items-center gap-3">
                      <Toggle
                        id="toggle-motion"
                        checked={settings.reduceMotion}
                        onChange={(v) => update("reduceMotion", v)}
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        {settings.reduceMotion
                          ? "مُفعَّل — الرسوم المتحركة مُقلَّلة"
                          : "معطَّل — الرسوم المتحركة مُفعَّلة"}
                      </span>
                    </label>
                  </SettingRow>
                </CardBody>
              </Card>

              {/* Language info card */}
              <div className="mt-4">
                <Card className="border border-slate-100 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-blue-50 p-1.5">
                        <Languages className="h-5 w-5 text-blue-600" />
                      </div>
                      <CardTitle>اللغة والمنطقة</CardTitle>
                    </div>
                  </CardHeader>
                  <CardBody className="p-6">
                    <SettingRow
                      icon={<Languages size={16} />}
                      title="لغة الواجهة"
                      description="اللغة المعروضة حالياً في النظام"
                    >
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                        <span className="text-xl">🇸🇦</span>
                        <div>
                          <div className="text-sm font-bold text-slate-800">العربية</div>
                          <div className="text-xs text-slate-400">
                            اللغة الافتراضية للنظام — لا يمكن تغييرها حالياً
                          </div>
                        </div>
                      </div>
                    </SettingRow>
                  </CardBody>
                </Card>
              </div>

              {/* Save / Reset actions */}
              <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <motion.button
                  type="button"
                  whileTap={tapFeedback}
                  onClick={reset}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-500 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  <RotateCcw size={14} />
                  إعادة الضبط الافتراضي
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={tapFeedback}
                  onClick={() => save(settings)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ${
                    savedFlash
                      ? "bg-emerald-500 shadow-emerald-100"
                      : "bg-blue-600 shadow-blue-100 hover:bg-blue-700"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {savedFlash ? (
                      <motion.span
                        key="saved"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 size={16} />
                        تم الحفظ!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="save"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        حفظ الإعدادات
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div
              key="notifications"
              id="tabpanel-notifications"
              role="tabpanel"
              aria-labelledby="tab-notifications"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={variants.fadeSlideUp}
            >
              <Card className="border border-slate-100 shadow-md overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-50 p-1.5">
                      <Bell className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>الإشعارات</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="p-6">
                  <SettingRow
                    icon={<Bell size={16} />}
                    title="إشعارات التنبيهات الحرجة"
                    description="تنبيهات فورية عند اكتشاف تجاوزات أو أعطال في منظومة المياه"
                  >
                    <label htmlFor="toggle-notif" className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg p-2 ${settings.notifications ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                          {settings.notifications ? <BellRing size={18} /> : <BellOff size={18} />}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-800">
                            {settings.notifications ? "الإشعارات مُفعَّلة" : "الإشعارات معطَّلة"}
                          </div>
                          <div className="text-xs text-slate-400">
                            {settings.notifications
                              ? "ستتلقى تنبيهات فورية عند وجود أعطال أو تجاوزات"
                              : "لن تتلقى أي إشعارات من النظام"}
                          </div>
                        </div>
                      </div>
                      <Toggle
                        id="toggle-notif"
                        checked={settings.notifications}
                        onChange={(v) => update("notifications", v)}
                      />
                    </label>
                  </SettingRow>
                </CardBody>
              </Card>

              {/* Save actions */}
              <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <motion.button
                  type="button"
                  whileTap={tapFeedback}
                  onClick={reset}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-500 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  <RotateCcw size={14} />
                  إعادة الضبط الافتراضي
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={tapFeedback}
                  onClick={() => save(settings)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ${
                    savedFlash
                      ? "bg-emerald-500 shadow-emerald-100"
                      : "bg-blue-600 shadow-blue-100 hover:bg-blue-700"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {savedFlash ? (
                      <motion.span
                        key="saved"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 size={16} />
                        تم الحفظ!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="save"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        حفظ الإعدادات
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div
              key="profile"
              id="tabpanel-profile"
              role="tabpanel"
              aria-labelledby="tab-profile"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={variants.fadeSlideUp}
            >
              <Card className="border border-slate-100 shadow-md overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-50 p-1.5">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle>الملف الشخصي</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="p-6">
                  <ProfileTab />
                </CardBody>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
    </MotionConfig>
  );
}
