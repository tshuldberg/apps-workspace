import type { ComponentProps, TextareaHTMLAttributes } from 'react';

interface TextFieldProps extends ComponentProps<'input'> {
  label?: string;
}

export function TextField({ label, className, id, ...rest }: TextFieldProps): React.ReactElement {
  return (
    <label className="mk-field" htmlFor={id}>
      {label && <span className="mk-label">{label}</span>}
      <input id={id} className={`mk-input ${className ?? ''}`} {...rest} />
    </label>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, className, id, ...rest }: TextAreaProps): React.ReactElement {
  return (
    <label className="mk-field" htmlFor={id}>
      {label && <span className="mk-label">{label}</span>}
      <textarea id={id} className={`mk-textarea ${className ?? ''}`} {...rest} />
    </label>
  );
}
