import { forwardRef, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-text text-bg border-none hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-transparent text-text-muted border border-border hover:border-text-dim hover:text-text',
  danger: 'bg-transparent text-danger border border-danger hover:bg-danger hover:text-bg',
  ghost: 'bg-transparent text-text-dim border-none hover:text-text hover:bg-bg-secondary',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'py-2 px-3 text-sm',
  md: 'py-3 px-4 text-base',
  lg: 'py-3.5 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`font-medium rounded-lg cursor-pointer transition-all ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
