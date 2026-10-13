import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";

const PLACEHOLDER_LABEL = { logo: "Logo", signature: "Signature", image: "Image" } as const;

// `assetSrc` is the resolved URL of props.assetId, or of the brand kit's logo
// for a logo box without its own (fetched by the caller, useElementAssetUrl). The
// gray placeholder is a design aid: previews of real receipts turn it off, like
// the PDF, which draws nothing for an image without a file.
export const ImageEl = React.forwardRef<HTMLDivElement, ElementProps<"image"> & { assetSrc?: string; showPlaceholder?: boolean }>(
  ({ element, assetSrc, showPlaceholder = true, ...domProps }, ref) => {
    const { props } = element;
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        {assetSrc ? (
          <img
            src={assetSrc}
            alt={PLACEHOLDER_LABEL[props.source]}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: props.fit, display: "block" }}
          />
        ) : showPlaceholder && (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm text-gray-500">
            {PLACEHOLDER_LABEL[props.source].toLowerCase()}
          </div>
        )}
      </BaseElementWrapper>
    );
  },
);
ImageEl.displayName = "ImageEl";
