import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#00B9AD] text-white hover:bg-[#009E94] active:bg-[#00857C] rounded-full shadow-sm",
  secondary:
    "bg-white text-[#0F292E] border border-[#C5E4E8] hover:bg-[#EDF8FA] active:bg-[#DCEEEF] rounded-xl",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 rounded-xl shadow-sm",
  ghost:
    "bg-transparent text-[#0F292E] hover:bg-[#EDF8FA] active:bg-[#DCEEEF] rounded-xl",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-[48px] min-w-[48px] px-5 py-2.5 text-sm font-semibold",
  sm: "min-h-[48px] min-w-[48px] px-4 py-2 text-xs font-semibold",
};

export function Button({
  variant = "primary",
  size = "default",
  isLoading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center gap-2 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B9AD] focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      <span>{children}</span>
    </button>
  );
}
