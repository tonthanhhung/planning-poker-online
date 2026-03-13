import { ButtonHTMLAttributes, forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
  secondary: 'bg-neutral-light text-secondary hover:bg-neutral-200 focus:ring-neutral-light',
  danger: 'bg-error/10 text-error hover:bg-error/20 focus:ring-error',
  ghost: 'bg-transparent text-secondary hover:bg-neutral-light focus:ring-neutral-light',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium',
  md: 'px-4 py-2 text-sm font-medium',
  lg: 'px-6 py-3 text-base font-semibold',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { 
      variant = 'primary', 
      size = 'md', 
      className = '', 
      disabled, 
      children, 
      ...props 
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      rounded font-medium
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${className}
    `

    return (
      <button
        ref={ref}
        className={baseStyles}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
