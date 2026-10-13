import { describe, expect, it } from "vitest";
import { applyBrand, colorRole, lighten } from "./brand";
import { STARTER_TEMPLATES } from "./starterTemplates";
import type { CanvasElement } from "../schema/templateSchema";

const starter = (id: string) => STARTER_TEMPLATES.find((t) => t.id === id)!.canvas;
const byId = (elements: CanvasElement[], id: string) => elements.find((e) => e.id === id)!;

describe("brand kit", () => {
  it("tells accents and tints from neutrals", () => {
    expect(colorRole("#9D174D")).toBe("accent");
    expect(colorRole("#DDD6FE")).toBe("tint");
    expect(colorRole("#6B7280")).toBeNull(); // grey
    expect(colorRole("#111111")).toBeNull();
    expect(colorRole("#FFFFFF")).toBeNull();
    expect(lighten("#000000", 0.5)).toBe("#808080");
  });

  it("gives a template the brand colour and fonts, and keeps its greys", () => {
    const salon = starter("salon-receipt");
    const branded = applyBrand(salon, { color: "#0F766E", fonts: "merriweather-lato" });
    const name = byId(branded.elements, "name");
    const address = byId(branded.elements, "address");
    const rule = byId(branded.elements, "rule");
    expect(name.type === "text" && [name.props.color, name.props.fontFamily]).toEqual(["#0F766E", "Merriweather"]);
    expect(address.type === "text" && [address.props.color, address.props.fontFamily]).toEqual(["#6B7280", "Lato"]);
    expect(rule.type === "divider" && rule.props.color).toBe("#0F766E");
    // Nothing moves
    expect(branded.elements.map((e) => [e.id, e.x, e.y, e.width, e.height])).toEqual(salon.elements.map((e) => [e.id, e.x, e.y, e.width, e.height]));
  });

  it("only changes what the kit sets, and keeps a till-roll font", () => {
    const restaurant = starter("restaurant-receipt");
    expect(applyBrand(restaurant, {})).toBe(restaurant);
    const fontsOnly = applyBrand(restaurant, { fonts: "poppins-inter" });
    const name = byId(fontsOnly.elements, "name");
    expect(name.type === "text" && name.props.fontFamily).toBe("Roboto Mono");
    const salon = applyBrand(starter("salon-receipt"), { fonts: "poppins-inter" });
    const title = byId(salon.elements, "name");
    expect(title.type === "text" && [title.props.fontFamily, title.props.color]).toEqual(["Poppins", "#9D174D"]);
  });
});
