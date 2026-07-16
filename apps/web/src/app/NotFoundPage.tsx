import { Link } from "react-router-dom";
import { useLocale } from "../i18n";

export function NotFoundPage() {
  const { t } = useLocale();
  return (
    <div className="py-16 text-center">
      <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">{t("notFound.title")}</h1>
      <p className="mt-2 text-sm text-ink-2">{t("notFound.body")}</p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-page hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rent"
      >
        {t("notFound.home")}
      </Link>
    </div>
  );
}
