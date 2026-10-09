import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editorStore";
import type { CanvasElement } from "../schema/templateSchema";
import { DEFAULT_ELEMENTS, MAX_DESIGN_HEIGHT, PAGE_PRESETS } from "../lib/units";

describe("editorStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useEditorStore.setState({
      page: {
        preset: "thermal80",
        width: 302,
        height: 400,
        heightMode: "auto",
        background: "#FFFFFF",
        margin: 12,
      },
      elements: [],
      selectedId: null,
      zoom: 1,
      past: [],
      future: [],
      editingId: null,
      lastCoalesceKey: null,
    });
  });

  const getDummyText = (): CanvasElement => ({
    id: "test-text",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    zIndex: 1,
    locked: false,
    props: {
      content: "Hello",
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      color: "#000000",
      align: "left",
      lineHeight: 1.3,
    },
  });

  it("can add an element", () => {
    const el = getDummyText();
    useEditorStore.getState().addElement(el);
    expect(useEditorStore.getState().elements.length).toBe(1);
    expect(useEditorStore.getState().selectedId).toBe("test-text");
  });

  it("can move an element", () => {
    const el = getDummyText();
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().moveElement("test-text", 50, 60);
    
    // Nearest snap to 4px: 50 -> 48 (50/4 = 12.5 -> 13*4 = 52), wait: 50/4 = 12.5, round is 13, 13*4=52.
    // 60 / 4 = 15, 15*4=60.
    expect(useEditorStore.getState().elements[0].x).toBe(52);
    expect(useEditorStore.getState().elements[0].y).toBe(60);
  });

  it("clamps move inside bounds", () => {
    const el = getDummyText(); // w: 100, page width: 302
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().moveElement("test-text", 1000, -100);
    
    const elements = useEditorStore.getState().elements;
    // 302 - 100 = 202 -> floored to the grid: 200 (snapping up to 204 would overshoot)
    expect(elements[0].x).toBe(200);
    expect(elements[0].y).toBe(0); // clamped to 0
  });

  it("never lets a snapped position overshoot the right edge", () => {
    const el = { ...getDummyText(), width: 200 };
    useEditorStore.getState().addElement(el);
    // 102 is where a live drag clamps to (302 - 200); it used to snap up to 104
    useEditorStore.getState().updateElementGeometry(el.id, { x: 102 });
    const { x, width } = useEditorStore.getState().elements[0];
    expect(x).toBe(100);
    expect(x + width).toBeLessThanOrEqual(302);
  });

  it("a resize keeps the position and caps the size at the page edge", () => {
    const el = { ...getDummyText(), x: 100, width: 100 };
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().resizeElement(el.id, 250, 40);
    const resized = useEditorStore.getState().elements[0];
    expect(resized.x).toBe(100);
    expect(resized.width).toBe(200); // 302 - 100 = 202 -> floored to 200
    expect(resized.height).toBe(40);
  });

  it("keeps zIndex in step with array order after deletes and adds", () => {
    const store = useEditorStore.getState();
    for (const id of ["a", "b", "c"]) store.addElement({ ...getDummyText(), id });
    store.deleteElement("a");
    store.deleteElement("b");
    store.addElement({ ...getDummyText(), id: "d", zIndex: 99 });
    // previously "d" got zIndex = length + 1 = 2 while "c" kept 3, so the newest
    // element painted underneath an older one
    expect(useEditorStore.getState().elements.map((e) => [e.id, e.zIndex])).toEqual([["c", 1], ["d", 2]]);
  });

  it("can resize an element", () => {
    const el = getDummyText();
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().resizeElement("test-text", 150, 75);
    
    // Snap to 4px: 150 -> 152 (150/4=37.5 -> 38*4=152), 75 -> 76
    expect(useEditorStore.getState().elements[0].width).toBe(152);
    expect(useEditorStore.getState().elements[0].height).toBe(76);
  });

  it("can delete an element", () => {
    const el = getDummyText();
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().deleteElement("test-text");
    expect(useEditorStore.getState().elements.length).toBe(0);
    expect(useEditorStore.getState().selectedId).toBeNull();
  });

  it("supports undo and redo", () => {
    const el = getDummyText();
    useEditorStore.getState().addElement(el);
    expect(useEditorStore.getState().elements.length).toBe(1);
    
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().elements.length).toBe(0);
    
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().elements.length).toBe(1);
  });

  it("does not mix zoom into element geometry", () => {
    const el = getDummyText();
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().setZoom(2.0);
    
    // Zoom changed, element geometry should remain unscaled
    expect(useEditorStore.getState().elements[0].width).toBe(100);
    expect(useEditorStore.getState().zoom).toBe(2.0);
  });

  it("updateElementGeometry with only x/y leaves an off-grid size untouched", () => {
    const el = { ...getDummyText(), width: 278, height: 30 };
    useEditorStore.getState().addElement(el);
    useEditorStore.getState().updateElementGeometry(el.id, { x: 8, y: 40 });

    const moved = useEditorStore.getState().elements[0];
    expect(moved.x).toBe(8);
    expect(moved.y).toBe(40);
    expect(moved.width).toBe(278); // was re-snapped to 280, overflowing a 302px page at x=24
    expect(moved.height).toBe(30);
  });

  it("updateElementGeometry saves exactly one snapshot", () => {
    const mockElement = getDummyText();
    useEditorStore.getState().addElement(mockElement);
    const pastBefore = useEditorStore.getState().past.length;
    
    useEditorStore.getState().updateElementGeometry(mockElement.id, { x: 50, y: 50, width: 200, height: 100 });
    
    const state = useEditorStore.getState();
    expect(state.past.length).toBe(pastBefore + 1);
    expect(state.elements[0].x).toBe(52); // snapped to 4
    expect(state.elements[0].width).toBe(200);
  });

  const setContent = (content: string, coalesceKey?: string) =>
    useEditorStore.getState().updateElement("test-text", (el) => {
      if (el.type === "text") el.props.content = content;
    }, { coalesceKey });

  it("coalesces consecutive edits with the same key into one undo step", () => {
    useEditorStore.getState().addElement(getDummyText());
    const pastBefore = useEditorStore.getState().past.length;
    for (const content of ["H", "He", "Hey"]) setContent(content, "test-text:content");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);

    useEditorStore.getState().undo();
    const el = useEditorStore.getState().elements[0];
    expect(el.type === "text" && el.props.content).toBe("Hello");

    // after undo, a new run starts a new step; un-keyed edits always do
    setContent("A", "test-text:content");
    setContent("B");
    setContent("C");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 3);
  });

  it("keeps the items table height equal to header + sample rows", () => {
    const table = { id: "t", type: "items_table", x: 0, y: 0, zIndex: 1, ...DEFAULT_ELEMENTS.items_table } as CanvasElement;
    useEditorStore.getState().addElement(table);
    useEditorStore.getState().updateElement("t", (el) => {
      if (el.type === "items_table") el.props.fontSize = 20; // ceil(20 * 1.3) + 8 = 34 per row
    });
    expect(useEditorStore.getState().elements[0].height).toBe(4 * 34);
    // a resize can change the width but not the derived height
    useEditorStore.getState().updateElementGeometry("t", { width: 200, height: 40 });
    expect(useEditorStore.getState().elements[0]).toMatchObject({ width: 200, height: 4 * 34 });
  });

  it("switching to a fixed page pulls elements inside; back to thermal keeps them visible", () => {
    useEditorStore.setState({ page: PAGE_PRESETS.a4 });
    useEditorStore.getState().addElement({ ...getDummyText(), x: 600, y: 1000, width: 150, height: 50 });

    useEditorStore.getState().setPagePreset("a5"); // 559 x 794
    let el = useEditorStore.getState().elements[0];
    expect(el.x + el.width).toBeLessThanOrEqual(559);
    expect(el.y + el.height).toBeLessThanOrEqual(794);

    useEditorStore.getState().updateElementGeometry("test-text", { y: 700 });
    useEditorStore.getState().setPagePreset("thermal80"); // 302 wide, 400 design height
    const { page } = useEditorStore.getState();
    el = useEditorStore.getState().elements[0];
    expect(page.heightMode).toBe("auto");
    expect(el.x + el.width).toBeLessThanOrEqual(302);
    expect(page.height).toBeGreaterThanOrEqual(el.y + el.height); // grew past 400 to fit
  });

  it("design height is editable on thermal pages only, within content and limits", () => {
    useEditorStore.getState().addElement({ ...getDummyText(), y: 300 }); // bottom at 350
    useEditorStore.getState().updatePage({ height: 100 });
    expect(useEditorStore.getState().page.height).toBe(352); // can't cut off content
    useEditorStore.getState().updatePage({ height: 99999 });
    expect(useEditorStore.getState().page.height).toBe(MAX_DESIGN_HEIGHT);

    useEditorStore.getState().setPagePreset("a4");
    useEditorStore.getState().updatePage({ height: 500, background: "#FFF8E7" });
    expect(useEditorStore.getState().page).toMatchObject({ height: 1123, background: "#FFF8E7" });
  });

  it("selecting another element ends inline editing", () => {
    useEditorStore.getState().addElement(getDummyText());
    useEditorStore.getState().addElement({ ...getDummyText(), id: "other" });
    useEditorStore.getState().setEditingId("test-text");
    expect(useEditorStore.getState()).toMatchObject({ editingId: "test-text", selectedId: "test-text" });
    useEditorStore.getState().selectElement("other");
    expect(useEditorStore.getState().editingId).toBeNull();
  });
});
