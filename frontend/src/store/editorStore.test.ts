import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editorStore";
import type { CanvasElement } from "../schema/templateSchema";

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
    expect(elements[0].x).toBeLessThanOrEqual(204); // 302 - 100 = 202; closest multiple of 4 is 200 or 204.
    expect(elements[0].y).toBe(0); // clamped to 0
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
});
