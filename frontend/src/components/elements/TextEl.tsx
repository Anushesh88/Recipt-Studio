import React from "react";
import { BaseElementWrapper, type ElementProps } from "./BaseElementWrapper";
import { fontStack } from "../../lib/units";
import { resolveVariables, splitVariables, variableKind, SAMPLE_VALUES, type VariableValues } from "../../lib/variables";

// How a placeholder looks on the design canvas: built-ins show their sample value,
// custom variables a chip with their name, unknown ones a red chip.
const CHIP_CLASS = {
  builtin: "rounded-sm bg-sky-100 text-sky-900",
  custom: "rounded-sm bg-amber-100 px-0.5 text-amber-900",
  unknown: "rounded-sm bg-red-100 px-0.5 text-red-700 line-through",
} as const;

const VariableChip: React.FC<{ varKey: string; raw: string }> = ({ varKey, raw }) => {
  const kind = variableKind(varKey);
  const label = kind === "builtin" ? SAMPLE_VALUES[varKey] : kind === "custom" ? varKey : raw;
  return (
    <span data-variable={varKey} data-variable-kind={kind} className={CHIP_CLASS[kind]} title={raw}>
      {label}
    </span>
  );
};

// `values` resolves placeholders to real data (Generate preview); without it the
// editor shows samples and chips instead.
export const TextEl = React.forwardRef<HTMLDivElement, ElementProps<"text"> & { values?: VariableValues }>(
  ({ element, values, ...domProps }, ref) => {
    const { props } = element;
    const content = values
      ? resolveVariables(props.content, values)
      : splitVariables(props.content).map((segment, i) =>
          segment.type === "text" ? segment.text : <VariableChip key={i} varKey={segment.key} raw={segment.raw} />,
        );

    return (
      <BaseElementWrapper element={element} ref={ref} {...domProps}>
        <div
          style={{
            fontFamily: fontStack(props.fontFamily),
            fontSize: `${props.fontSize}px`,
            fontWeight: props.fontWeight,
            color: props.color,
            textAlign: props.align,
            lineHeight: props.lineHeight,
            // Keep the line breaks typed in the editor
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            width: "100%",
            height: "100%",
          }}
        >
          {content}
        </div>
      </BaseElementWrapper>
    );
  },
);
TextEl.displayName = "TextEl";
