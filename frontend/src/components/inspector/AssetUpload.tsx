import React, { useId, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "../../api/client";
import { uploadAsset, useAssetUrl, validateImageFile, ACCEPTED_IMAGE_TYPES, type AssetKind } from "../../api/assets";
import { Field } from "./fields";

// Upload / replace / remove the image behind an image or signature element
export const AssetUpload: React.FC<{
  label: string;
  kind: AssetKind;
  assetId: string | null;
  onChange: (assetId: string | null) => void;
}> = ({ label, kind, assetId, onChange }) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const src = useAssetUrl(assetId);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    try {
      const asset = await uploadAsset(file, kind);
      onChange(asset.id);
    } catch (e) {
      setError(apiErrorMessage(e, "Upload failed. Please try again."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Field label={label} htmlFor={inputId} hint="PNG or JPG, up to 2 MB.">
      <div className="flex items-center gap-2">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {src ? (
            <img src={src} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">{assetId ? "…" : "None"}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="xs" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <ImageUp />
            {uploading ? "Uploading…" : assetId ? "Replace image" : "Upload image"}
          </Button>
          {assetId && (
            <Button type="button" variant="ghost" size="xs" onClick={() => onChange(null)}>
              <Trash2 />
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </Field>
  );
};
