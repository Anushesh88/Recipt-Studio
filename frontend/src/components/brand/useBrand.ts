// The signed-in account's brand kit, for the editor, previews and the gallery
import { useAccount } from "../../api/account";
import { useAssetUrl } from "../../api/assets";
import type { Brand } from "../../lib/brand";
import type { CanvasElement } from "../../schema/templateSchema";

export function useBrand(): Brand & { logoAssetId: string | null } {
  const { data: account } = useAccount();
  return { color: account?.brand_color, fonts: account?.brand_fonts, logoAssetId: account?.brand_logo_asset_id ?? null };
}

// The image an image / signature element shows: its own upload, or for a logo
// box without one, the brand kit's logo (as the server renders it)
export function useElementAssetUrl(element: CanvasElement | undefined): string | undefined {
  const { logoAssetId } = useBrand();
  let assetId: string | null = null;
  if (element?.type === "image") assetId = element.props.assetId ?? (element.props.source === "logo" ? logoAssetId : null);
  else if (element?.type === "signature") assetId = element.props.assetId;
  return useAssetUrl(assetId);
}
