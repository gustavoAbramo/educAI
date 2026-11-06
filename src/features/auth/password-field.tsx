import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type KeyboardEvent } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  visible: boolean;
  onToggleVisible: () => void;
};

export function PasswordField({
  id,
  label,
  error,
  hint,
  visible,
  onToggleVisible,
  ...input
}: PasswordFieldProps) {
  const [capsLock, setCapsLock] = useState(false);
  const describedBy = [hint && `${id}-hint`, capsLock && `${id}-caps`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState("CapsLock"));

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="login-password">
        <input
          {...input}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onKeyUp={trackCapsLock}
          onKeyDown={trackCapsLock}
          onBlur={(event) => {
            setCapsLock(false);
            input.onBlur?.(event);
          }}
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={id}
          onClick={onToggleVisible}
        >
          {visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="login-hint">
          {hint}
        </p>
      ) : null}
      {capsLock ? (
        <p id={`${id}-caps`} className="login-hint login-warning" role="status">
          Caps Lock está ativado.
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="login-field-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
