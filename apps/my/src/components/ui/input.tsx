import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const baseInputStyles =
  'w-full py-3.5 px-4 text-base border border-border rounded-lg bg-bg-secondary text-text outline-none transition-colors focus:border-text-dim placeholder:text-text-dimmer font-[inherit]'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return <input ref={ref} className={`${baseInputStyles} ${className}`} {...props} />
  }
)

Input.displayName = 'Input'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`${baseInputStyles} resize-y min-h-[100px] ${className}`}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <label ref={ref} className={`text-sm text-text-muted ${className}`} {...props}>
        {children}
      </label>
    )
  }
)

Label.displayName = 'Label'
