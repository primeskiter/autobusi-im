import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";

/**
 * Subtle offline indicator banner.
 * Shows when the device loses connectivity, auto-dismisses when back online.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation("common");

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" as const }}
          className="absolute top-14 md:top-4 left-1/2 -translate-x-1/2 z-[1100] pointer-events-auto"
        >
          <div className="flex items-center gap-2 bg-foreground/90 text-background px-3.5 py-2 rounded-full shadow-lg backdrop-blur-sm">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">
              {t("offline.banner")}
            </span>
          </div>
          <div className="mt-1.5 text-center">
            <span className="text-[10px] text-background/70 bg-foreground/70 px-2.5 py-0.5 rounded-full">
              {t("offline.available")}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
