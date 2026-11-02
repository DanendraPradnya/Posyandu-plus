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
    <div className="w-full space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-900"
      >
        {label}
        {required && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
      </label>

      <div className="relative flex items-center">
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={[
            "w-full min-h-[48px] rounded-xl border bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-gray-900",
            "disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
            error
              ? "border-red-600 focus-visible:ring-red-700"
              : "border-gray-300",
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
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-gray-600">
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
    <div className="w-full space-y-1.5">
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-gray-900"
      >
        {label}
        {required && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
      </label>

      <select
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        className={[
          "w-full min-h-[48px] rounded-xl border bg-white px-4 py-3 text-base text-gray-900",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:border-gray-900",
          "disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed",
          error ? "border-red-600 focus-visible:ring-red-700" : "border-gray-300",
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
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-gray-600">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

