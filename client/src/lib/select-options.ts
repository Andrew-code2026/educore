import type { SelectOption } from "@/components/option-select";

/**
 * Opciones cuyo texto es el propio valor. Con `emptyLabel`, la primera opción es `""`: deja el
 * campo sin elegir y, mientras lo está, ese texto rotula el disparador.
 */
export function optionsFrom<V extends string>(values: readonly V[]): SelectOption<V>[];
export function optionsFrom<V extends string>(values: readonly V[], emptyLabel: string): SelectOption<V | "">[];
export function optionsFrom<V extends string>(values: readonly V[], emptyLabel?: string): SelectOption<V | "">[] {
  const options: SelectOption<V | "">[] = values.map(value => ({ value, label: value }));
  return emptyLabel === undefined ? options : [{ value: "", label: emptyLabel }, ...options];
}
