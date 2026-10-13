import React, { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountKeys, updateAccount, type Account, type AccountChanges } from "../../api/account";
import { ACCEPTED_IMAGE_TYPES, uploadAsset, useAssetUrl, validateImageFile } from "../../api/assets";
import { apiErrorMessage } from "../../api/client";
import { BRAND_COLOR_SWATCHES, BRAND_FONT_PAIRS, fontPair, lighten } from "../../lib/brand";
import { fontStack } from "../../lib/units";

// Settings > Brand kit: a logo for every logo box, a colour and a font pairing
// that ready-made templates take on (and the editor can apply). Each change is
// saved straight away.
export const BrandKitSettings: React.FC<{ account: Account }> = ({ account }) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const colorId = useId();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const logo = useAssetUrl(account.brand_logo_asset_id);
  const color = account.brand_color;
  const pair = fontPair(account.brand_fonts);

  const save = async (changes: AccountChanges, message: string) => {
    setBusy(true);
    setStatus(null);
    try {
      queryClient.setQueryData(accountKeys.me, await updateAccount(changes));
      setStatus({ ok: true, message });
    } catch (e) {
      setStatus({ ok: false, message: apiErrorMessage(e, "Couldn't save your brand kit.") });
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setStatus({ ok: false, message: problem });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const asset = await uploadAsset(file, "logo");
      await save({ brand_logo_asset_id: asset.id }, "Logo saved.");
    } catch (e) {
      setStatus({ ok: false, message: apiErrorMessage(e, "Upload failed. Please try again.") });
      setBusy(false);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section id="brand-kit" className="mt-6 scroll-mt-4 space-y-5 rounded-lg border border-border bg-white p-6" data-brand-kit="">
      <div>
        <h2 className="text-lg font-semibold">Brand kit</h2>
        <p className="text-sm text-muted-foreground">
          Set these once. Logo boxes show your logo, and ready-made templates use your colour and fonts.
          In the editor, <strong>Apply my brand colour and fonts</strong> (on the Page panel) restyles a template you already have.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Logo</p>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {logo ? <img src={logo} alt="Your logo" className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" aria-label="Logo file" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImageUp />
              {account.brand_logo_asset_id ? "Replace logo" : "Upload logo"}
            </Button>
            {account.brand_logo_asset_id && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void save({ brand_logo_asset_id: null }, "Logo removed.")}>
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB. A wide logo on a transparent background looks best.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium" id={`${colorId}-label`}>Colour</p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={`${colorId}-label`}>
          {BRAND_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              disabled={busy}
              aria-label={`Brand colour ${swatch}`}
              aria-pressed={color?.toUpperCase() === swatch}
              onClick={() => void save({ brand_color: swatch }, "Colour saved.")}
              className="flex size-8 items-center justify-center rounded-full border border-border text-white aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2"
              style={{ background: swatch }}
            >
              {color?.toUpperCase() === swatch && <Check className="size-4" />}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              id={colorId}
              type="color"
              disabled={busy}
              aria-label="Choose any colour"
              value={(color ?? "#4F46E5").toLowerCase()}
              onChange={(e) => void save({ brand_color: e.target.value.toUpperCase() }, "Colour saved.")}
              className="h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
            Other
          </label>
          {color && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void save({ brand_color: "" }, "Colour removed.")}>
              No colour
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Fonts</p>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Font pairing">
          {[{ id: "", label: "Keep each template's fonts", heading: null, body: null }, ...BRAND_FONT_PAIRS].map((option) => {
            const chosen = (account.brand_fonts ?? "") === option.id;
            return (
              <button
                key={option.id || "none"}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={busy}
                onClick={() => void save({ brand_fonts: option.id }, "Fonts saved.")}
                className="rounded-md border border-border p-3 text-left aria-checked:border-primary aria-checked:ring-1 aria-checked:ring-primary"
              >
                {option.heading ? (
                  <>
                    <span className="block text-base font-bold" style={{ fontFamily: fontStack(option.heading) }}>Your Business</span>
                    <span className="block text-xs" style={{ fontFamily: fontStack(option.body) }}>{option.label}</span>
                  </>
                ) : (
                  <span className="block text-sm">{option.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {(color || pair || logo) && (
        <div className="rounded-md border border-border p-4" aria-label="Brand preview" data-brand-preview="">
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt="" className="h-10 w-20 object-contain" />}
            <div>
              <p className="text-lg font-bold" style={{ color: color ?? undefined, fontFamily: pair ? fontStack(pair.heading) : undefined }}>
                {account.business_name || "Your Business"}
              </p>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: pair ? fontStack(pair.body) : undefined }}>Receipt R-0001 · Thank you for your business!</p>
            </div>
          </div>
          {color && <div className="mt-3 h-1 rounded" style={{ background: color }} />}
          {color && <div className="mt-1 h-3 rounded" style={{ background: lighten(color, 0.8) }} />}
        </div>
      )}

      {status && (
        <p role={status.ok ? "status" : "alert"} className={`text-sm ${status.ok ? "text-green-700" : "text-destructive"}`}>{status.message}</p>
      )}
    </section>
  );
};
