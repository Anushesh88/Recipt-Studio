// Error alerts to Sentry, only when VITE_SENTRY_DSN is set at build time. The
// SDK is loaded lazily, so it costs nothing otherwise. No personal data: no
// user info, cookies, headers, bodies or query strings (a password reset link
// carries its token in the query string).

const withoutQuery = (url: string | undefined) => url?.split("?")[0];

export function startErrorReporting(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  void import("@sentry/react").then((Sentry) =>
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      beforeSend(event) {
        if (event.request?.url) event.request.url = withoutQuery(event.request.url);
        return event;
      },
      beforeBreadcrumb(crumb) {
        const data = crumb.data as { url?: string; from?: string; to?: string } | undefined;
        if (data) {
          for (const key of ["url", "from", "to"] as const) if (data[key]) data[key] = withoutQuery(data[key]);
        }
        return crumb;
      },
    }),
  );
}
