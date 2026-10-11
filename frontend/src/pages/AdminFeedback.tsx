import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useFeedbackList } from "../api/feedback";
import { apiErrorMessage } from "../api/client";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

// /admin/feedback: what users sent with the Feedback button (admins only)
export const AdminFeedback: React.FC = () => {
  const { data, isLoading, isError, error } = useFeedbackList();
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ChevronLeft className="size-4" />
          Settings
        </Link>
        <h1 className="text-3xl font-bold">Feedback</h1>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(error, "Couldn't load the feedback.")}</p>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No feedback yet.</p>}
      <ul className="space-y-3">
        {data?.map((f) => (
          <li key={f.id} className="rounded-lg border border-border bg-white p-4" data-feedback-item="">
            <p className="whitespace-pre-wrap text-sm">{f.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              <a href={`mailto:${f.email}`} className="hover:underline">{f.email}</a> · {when(f.created_at)}{f.page ? ` · ${f.page}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};
