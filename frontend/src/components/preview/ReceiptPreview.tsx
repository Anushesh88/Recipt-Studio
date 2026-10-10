import React from "react";
import type { Canvas, CanvasElement } from "../../schema/templateSchema";
import { applyLayout, BRAND_STRIP_HEIGHT, CONTENT_OVERFLOW } from "../../lib/layout";
import { BrandStrip } from "../brand/BrandStrip";
import type { VariableValues } from "../../lib/variables";
import { useAssetUrl } from "../../api/assets";
import { DividerEl, ImageEl, QrEl, SignatureEl, TableEl, TextEl, TotalsEl } from "../elements";
import { ElementErrorBoundary } from "../elements/ElementErrorBoundary";
import type { TableRow } from "../elements/TableEl";
import type { TotalsValues } from "../elements/TotalsEl";
import type { TaxRow } from "../../lib/elementLayout";

interface ReceiptData {
  values: VariableValues;
  rows: TableRow[];
  totals: TotalsValues;
  // What the totals' tax line prints as (GST invoices: CGST + SGST, or IGST)
  taxRows?: TaxRow[];
  // Gray boxes where a logo / image hasn't been uploaded (the template gallery)
  imagePlaceholders?: boolean;
}

const PreviewElement: React.FC<{ element: CanvasElement } & ReceiptData> = ({ element, values, rows, totals, taxRows, imagePlaceholders = false }) => {
  const assetId = element.type === "image" || element.type === "signature" ? element.props.assetId : null;
  const assetSrc = useAssetUrl(assetId);
  switch (element.type) {
    case "text":
      return <TextEl element={element} values={values} />;
    case "qr":
      return <QrEl element={element} values={values} />;
    case "items_table":
      return <TableEl element={element} rows={rows} />;
    case "totals":
      return <TotalsEl element={element} values={totals} taxRows={taxRows} />;
    case "image":
      return <ImageEl element={element} assetSrc={assetSrc} showPlaceholder={imagePlaceholders} />;
    case "signature":
      return <SignatureEl element={element} assetSrc={assetSrc} />;
    case "divider":
      return <DividerEl element={element} />;
  }
};

// A filled-in receipt: the template laid out for rows.length line items (the
// shared Layout Algorithm) and drawn with the same element components as the
// editor, at `scale`.
export const ReceiptPreview: React.FC<{ canvas: Canvas; scale?: number } & ReceiptData> = ({
  canvas,
  scale = 1,
  values,
  rows,
  totals,
  taxRows,
  imagePlaceholders,
}) => {
  const layout = applyLayout(canvas.page, canvas.elements, rows.length);
  const { page } = canvas;
  // Auto-height pages grow to fit the brand strip; fixed pages hold it in the margin
  const pageHeight = layout.pageHeight + (page.heightMode === "auto" ? BRAND_STRIP_HEIGHT : 0);

  return (
    <div className="space-y-3">
      {layout.error === CONTENT_OVERFLOW && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This doesn't fit on one {page.preset.toUpperCase()} page: content runs past the bottom margin. Remove
          some line items or move elements up in the template.
        </p>
      )}
      <div style={{ width: page.width * scale, height: pageHeight * scale }} className="shadow-lg">
        <div
          data-receipt-preview=""
          data-page-height={pageHeight}
          style={{
            position: "relative",
            width: page.width,
            height: pageHeight,
            backgroundColor: page.background,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            overflow: "hidden",
          }}
        >
          {layout.elements.map((element) => (
            <ElementErrorBoundary key={element.id} element={element}>
              <PreviewElement element={element} values={values} rows={rows} totals={totals} taxRows={taxRows} imagePlaceholders={imagePlaceholders} />
            </ElementErrorBoundary>
          ))}
          <BrandStrip top={pageHeight - BRAND_STRIP_HEIGHT} width={page.width} />
        </div>
      </div>
    </div>
  );
};
