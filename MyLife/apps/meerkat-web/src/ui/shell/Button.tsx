import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: '',
  ghost: 'is-ghost',
  danger: 'is-danger',
};

export function Button({
  variant = 'primary',
  small,
  className,
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  const classes = ['mk-btn', VARIANT_CLASS[variant], small ? 'is-small' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
