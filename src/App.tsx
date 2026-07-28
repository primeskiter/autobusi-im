import { Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import LocaleWrapper from "./components/providers/locale-wrapper.tsx";
import { SAVED_OR_DEFAULT_LOCALE, setLocaleInPath } from "./i18n.ts";
import "./i18n.ts";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";

function RootRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={setLocaleInPath(SAVED_OR_DEFAULT_LOCALE, "/", location.search, location.hash)}
      replace
    />
  );
}

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Suspense fallback={<div />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/:lng"
              element={
                <LocaleWrapper>
                  <Outlet />
                </LocaleWrapper>
              }
            >
              <Route index element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DefaultProviders>
  );
}
