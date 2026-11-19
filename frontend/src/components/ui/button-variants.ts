import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-hover',
        brand: 'border border-brand-hover bg-primary bg-linear-to-b from-brand-accent to-primary text-primary-foreground shadow-primary transition-[filter,box-shadow,transform] duration-200 hover:brightness-105 hover:shadow-lg motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0',
        ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        outline: 'border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
        danger: 'bg-danger text-primary-foreground hover:bg-danger-hover',
        'danger-soft': 'bg-danger-bg text-danger hover:bg-danger/15',
        'success-soft': 'bg-success-bg text-success hover:bg-success-bg-hover',
        'caution-soft': 'bg-caution-bg text-caution hover:bg-caution-bg-hover',
        'info-soft': 'bg-info-bg text-info hover:bg-info-bg-hover',
      },
      size: { default: 'h-12 px-5', comfortable: 'h-13 px-5', icon: 'size-11' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
