import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { MIN_ELEMENT_SIZE } from "../../lib/units";

interface Props {
  element: CanvasElement;
  // Lets the editor still select (and delete) an element that can't be drawn
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
  // The element as last rendered; a different one gets a fresh try
  element: CanvasElement;
}

// An element that throws while rendering shows a notice in its own box instead
// of unmounting the whole editor or preview (and losing unsaved work). It tries
// again whenever the element changes.
export class ElementErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, element: this.props.element };

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.element === state.element ? null : { element: props.element, failed: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { element, onPointerDown } = this.props;
    return (
      <div
        data-element-error={element.id}
        onPointerDown={onPointerDown}
        className="absolute flex items-center justify-center border-2 border-dashed border-red-400 bg-red-50 p-1 text-center text-xs text-red-700"
        style={{ left: element.x, top: element.y, width: element.width, height: Math.max(element.height, MIN_ELEMENT_SIZE) }}
      >
        Can't display this element
      </div>
    );
  }
}
