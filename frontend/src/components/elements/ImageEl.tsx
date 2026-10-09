import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";

const PLACEHOLDER_LABEL = { logo: "Logo", signature: "Signature", image: "Image" } as const;

// `assetSrc` is the resolved URL of props.assetId (fetched by the caller)
export const ImageEl = React.forwardRef<HTMLDivElement, ElementProps<"image"> & { assetSrc?: string }>(
  ({ element, assetSrc, ...domProps }, ref) => {
    const { props } = element;
    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        {props.assetId && assetSrc ? (
          <img
            src={assetSrc}
            alt={PLACEHOLDER_LABEL[props.source]}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: props.fit }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm text-gray-500">
            {PLACEHOLDER_LABEL[props.source].toLowerCase()}
          </div>
        )}
      </BaseElementWrapper>
    );
  },
);
ImageEl.displayName = "ImageEl";
