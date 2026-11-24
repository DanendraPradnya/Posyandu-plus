import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export function Input({
  id,
  label,
  helperText,
  error,
  rightElement,
  className = "",
  required,
  ...props
}: InputProps) {
  const inputId = id || `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full min-w-0 space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold text-[#0F292E]"
      >
        {label}
        {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
      </label>

      <div className="relative flex min-w-0 items-center">
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={[
            "w-full min-w-0 max-w-full min-h-[48px] rounded-xl border bg-white px-3.5 py-2.5 text-base sm:text-sm text-[#0F292E] placeholder:text-[#7A969C]",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD] focus-visible:border-[#00B9AD]",
            "disabled:bg-[#EDF8FA] disabled:text-[#4A666C] disabled:cursor-not-allowed",
            error
              ? "border-red-500 focus-visible:ring-red-600"
              : "border-[#C5E4E8]",
            rightElement ? "pr-14" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-1.5 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-[#4A666C]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
  error?: string;
}

export function Select({
  id,
  label,
  options,
  placeholder,
  helperText,
  error,
  className = "",
  required,
  ...props
}: SelectProps) {
  const selectId = id || `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className="w-full min-w-0 space-y-1.5">
      <label
        htmlFor={selectId}
        className="block text-xs font-semibold text-[#0F292E]"
      >
        {label}
        {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
      </label>

      <select
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        className={[
          "w-full min-w-0 max-w-full min-h-[48px] truncate text-ellipsis rounded-xl border bg-white pl-3.5 pr-8 py-2.5 text-base sm:text-sm text-[#0F292E]",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD] focus-visible:border-[#00B9AD]",
          "disabled:bg-[#EDF8FA] disabled:text-[#4A666C] disabled:cursor-not-allowed",
          error ? "border-red-500 focus-visible:ring-red-600" : "border-[#C5E4E8]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-[#4A666C]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
