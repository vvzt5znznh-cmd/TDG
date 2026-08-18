import { useEffect, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

/** Commits on blur / Enter so typing a label is one undo step, not one per key. */
export function CommitTextInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function flush() {
    if (draft !== value) onCommit(draft);
  }

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={flush}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  return (
    <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ...rest
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)} {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function StringList({
  values,
  onChange,
  addLabel = "Add",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  addLabel?: string;
}) {
  return (
    <div>
      {values.map((value, index) => (
        <div className="row" key={index} style={{ marginBottom: 6 }}>
          <input
            type="text"
            value={value}
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...values, ""])}>
        {addLabel}
      </button>
    </div>
  );
}

export function optionize<T extends string>(values: readonly T[], labels?: Record<T, string>) {
  return values.map((value) => ({ value, label: labels?.[value] ?? value.replaceAll("_", " ") }));
}

export function ColorInput({
  value,
  fallback,
  onChange,
}: {
  value: string | undefined;
  fallback: string;
  onChange: (value: string | undefined) => void;
}) {
  const current = value ?? fallback;
  return (
    <span className="color-input">
      <input type="color" value={current} onChange={(event) => onChange(event.target.value)} aria-label="Color" />
      {value ? (
        <button type="button" className="btn" onClick={() => onChange(undefined)}>
          Default
        </button>
      ) : null}
    </span>
  );
}
