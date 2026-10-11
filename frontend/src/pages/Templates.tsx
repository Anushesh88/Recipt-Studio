import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, Copy, FilePlus2, History as HistoryIcon, LogOut, Pencil, ReceiptText, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../store/authStore';
import { createTemplate, deleteTemplate, fetchTemplate, templateKeys, useTemplates, type TemplateSummary } from '../api/templates';
import { apiErrorMessage } from '../api/client';
import { useAccount } from '../api/account';
import { canvasSchema } from '../schema/templateSchema';
import { PAGE_PRESET_LABELS } from '../lib/units';
import { StarterGallery } from '../components/templates/StarterGallery';
import { Logo } from '../components/brand/Logo';

const formatUpdated = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

function TemplateCard({ template, onError }: { template: TemplateSummary; onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: templateKeys.all, exact: true });
    } catch (e) {
      onError(apiErrorMessage(e, failure));
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const duplicate = () =>
    run(async () => {
      const source = await fetchTemplate(template.id);
      await createTemplate(`${source.name} (copy)`, canvasSchema.parse(source.canvas));
    }, "Couldn't duplicate the template.");

  return (
    <article data-template-card={template.name} className="flex h-64 flex-col rounded-lg border border-border bg-white p-4 shadow-sm">
      <Link to={`/editor/${template.id}`} className="flex-1 space-y-1">
        <h2 className="line-clamp-2 text-lg font-semibold hover:underline">{template.name}</h2>
        {template.document_type === 'gst_invoice' && (
          <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800">GST tax invoice</span>
        )}
        <p className="text-sm text-muted-foreground">{PAGE_PRESET_LABELS[template.preset] ?? template.preset}</p>
        <p className="text-sm text-muted-foreground">
          {template.element_count} element{template.element_count === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-muted-foreground">Updated {formatUpdated(template.updated_at)}</p>
      </Link>
      {confirmingDelete ? (
        <div className="flex items-center justify-between gap-2" role="group" aria-label="Confirm delete">
          <span className="text-sm">Delete this template?</span>
          <div className="flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button size="xs" variant="destructive" disabled={busy} onClick={() => run(() => deleteTemplate(template.id), "Couldn't delete the template.")}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <Button asChild size="xs">
            <Link to={`/generate/${template.id}`}><ReceiptText />Generate</Link>
          </Button>
          <Button asChild size="xs" variant="outline">
            <Link to={`/editor/${template.id}`}><Pencil />Edit</Link>
          </Button>
          <Button size="xs" variant="outline" disabled={busy} onClick={duplicate}><Copy />Duplicate</Button>
          <Button size="xs" variant="ghost" disabled={busy} aria-label={`Delete ${template.name}`} onClick={() => setConfirmingDelete(true)}>
            <Trash2 />
          </Button>
        </div>
      )}
    </article>
  );
}

export default function Templates() {
  const setToken = useAuthStore((state) => state.setToken);
  const navigate = useNavigate();
  const { data: templates, isLoading, isError, error } = useTemplates();
  const account = useAccount();
  const [actionError, setActionError] = useState<string | null>(null);
  const mode = account.data?.invoicing_mode;

  // Asked once, right after sign-up
  if (account.data && mode === null) return <Navigate to="/welcome" replace />;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Link to="/templates" aria-label="Receipt Studio home"><Logo /></Link>
          <h1 className="text-3xl font-bold">My Templates</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/history"><HistoryIcon />Receipt history</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/reports"><BarChart3 />Sales report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/settings"><SettingsIcon />Settings</Link>
          </Button>
          <Button variant="ghost" onClick={() => setToken(null)}>
            <LogOut />
            Logout
          </Button>
        </div>
      </div>

      {actionError && <p role="alert" className="mb-4 text-sm text-destructive">{actionError}</p>}

      <StarterGallery mode={mode} onError={setActionError} />
      {isError && <p role="alert" className="mb-4 text-sm text-destructive">{apiErrorMessage(error, "Couldn't load your templates.")}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button
          type="button"
          onClick={() => navigate('/editor', { state: { documentType: mode === 'gst' ? 'gst_invoice' : 'receipt' } })}
          className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50"
        >
          <FilePlus2 className="size-6" />
          <span className="font-medium">{mode === 'gst' ? 'New blank GST invoice' : 'New blank receipt'}</span>
        </button>
        {templates?.map((t) => <TemplateCard key={t.id} template={t} onError={setActionError} />)}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading templates…</p>}
      {templates && templates.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No saved templates yet. Start with a blank receipt.</p>
      )}
    </div>
  );
}
