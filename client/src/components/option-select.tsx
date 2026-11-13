import type * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOptionValue = string | number;

export interface SelectOption<V extends SelectOptionValue = string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

type TriggerProps = React.ComponentProps<typeof SelectTrigger>;

export interface OptionSelectProps<V extends SelectOptionValue>
  extends Pick<
    TriggerProps,
    "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid" | "title" | "size" | "className"
  > {
  /** `null`, o `""` en selects de texto, muestra el `placeholder`. */
  value: V | null;
  onValueChange: (value: V) => void;
  options: readonly SelectOption<V>[];
  placeholder?: React.ReactNode;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Clases de la lista desplegable; `className` va al disparador. */
  contentClassName?: string;
}

/**
 * Select de shadcn para el caso común: un valor elegido de una lista plana de opciones.
 * Para grupos, separadores u opciones con contenido propio, componer `@/components/ui/select`.
 *
 * Base UI muestra en el disparador la etiqueta de la opción (vía `items`), no el valor crudo,
 * y trata `null` y `""` como "sin valor": así un `required` vacío bloquea el envío del formulario.
 */
export function OptionSelect<V extends SelectOptionValue>({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  name,
  required,
  disabled,
  className,
  contentClassName,
  ...triggerProps
}: OptionSelectProps<V>) {
  return (
    <Select<V>
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      items={options}
      value={value}
      onValueChange={next => {
        if (next !== null) onValueChange(next);
      }}
    >
      <SelectTrigger className={className} {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
