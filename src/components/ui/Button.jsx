/**
 * Button primitive.
 *
 * Centralises the focus ring, disabled treatment and loading behaviour so every
 * button in the product behaves identically. Without it, each page reinvents
 * these details and accessibility regresses quietly.
 *
 * Renders a `<button>` by default; pass `as` to render a router `<Link>` or an
 * `<a>` while keeping the same visual treatment.
 */

import { Spinner } from '@/components/ui/Spinner'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-card-hover shadow-card',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-card-hover shadow-card',
  microsoft: 'bg-[#2f2f2f] text-white hover:bg-black shadow-card',
  /**
   * Google's own sign-in button styling.
   *
   * White surface, a #dadce0 hairline and #3c4043 label — the light theme from
   * Google's identity branding guidelines. It is not the `secondary` variant
   * with a different icon: the guidelines specify the exact border, weight and
   * text colour, and a button claiming to be "Sign in with Google" is expected
   * to look like one.
   */
  google: 'bg-white text-[#3c4043] ring-1 ring-[#dadce0] hover:bg-[#f8f9fa] shadow-card',
}

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-4 py-2.5 text-sm gap-2.5',
}

/**
 * @param {{
 *   as?: import('react').ElementType,
 *   variant?: keyof typeof VARIANTS,
 *   size?: keyof typeof SIZES,
 *   isLoading?: boolean,
 *   loadingLabel?: string,
 *   fullWidth?: boolean,
 *   className?: string,
 *   children?: import('react').ReactNode,
 * } & Record<string, unknown>} props
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingLabel,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...rest
}) {
  const isDisabled = disabled || isLoading

  // `type` only applies to real buttons; setting it on an anchor is invalid HTML.
  const typeProp = Component === 'button' ? { type: rest.type ?? 'button' } : {}

  return (
    <Component
      {...typeProp}
      {...rest}
      disabled={Component === 'button' ? isDisabled : undefined}
      // Communicates the disabled state for non-button elements, which cannot
      // use the `disabled` attribute.
      aria-disabled={isDisabled || undefined}
      aria-busy={isLoading || undefined}
      className={[
        /*
         * Phase 16.1: transitions colour *and* elevation, on the shared timing.
         *
         * `active:translate-y-px` is the whole trick behind a button feeling
         * physical — a press that moves is a press the hand believes. One pixel
         * is enough; more reads as a toy.
         */
        'inline-flex items-center justify-center rounded-[--radius-control] font-medium',
        'transition-[background-color,box-shadow,transform,color] duration-[--duration-fast]',
        'active:translate-y-px disabled:active:translate-y-0',
        'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isLoading && <Spinner size="xs" tone={variant === 'secondary' || variant === 'ghost' ? 'muted' : 'light'} label="" />}
      {isLoading && loadingLabel ? loadingLabel : children}
    </Component>
  )
}

export default Button
