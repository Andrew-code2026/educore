import { ChevronDown } from "lucide-react";
import { firstName, initialsOf } from "@/student/format";
import type { GuardianChild } from "./children";
import "./guardian.css";

/** Hasta aquí caben como botones; con más hijos, una lista nativa. */
const MAX_BUTTONS = 4;

interface ChildSwitcherProps {
  items: GuardianChild[];
  selectedId: number;
  onSelect: (id: number) => void;
}

/**
 * A quién está mirando el acudiente. Con un solo hijo es una identificación, no un control;
 * con varios, el nombre de pila basta para distinguirlos y el curso va como apoyo.
 */
export function ChildSwitcher({ items, selectedId, onSelect }: ChildSwitcherProps) {
  if (items.length === 1) {
    const [child] = items;
    return (
      <p className="gdn-switch gdn-switch--single">
        <span className="gdn-switch__option">
          <span className="gdn-sr-only">Estudiante: </span>
          <span className="gdn-switch__avatar" aria-hidden="true">
            {initialsOf(child.name)}
          </span>
          {child.name}
          {child.courseName && <span className="gdn-switch__course">· {child.courseName}</span>}
        </span>
      </p>
    );
  }

  if (items.length > MAX_BUTTONS) {
    return (
      <div className="gdn-switch gdn-switch--select">
        <label htmlFor="gdn-child-select" className="gdn-sr-only">
          Estudiante
        </label>
        <select id="gdn-child-select" className="gdn-switch__select" value={selectedId} onChange={event => onSelect(Number(event.target.value))}>
          {items.map(child => (
            <option key={child.id} value={child.id}>
              {child.courseName ? `${child.name} · ${child.courseName}` : child.name}
            </option>
          ))}
        </select>
        <ChevronDown className="gdn-switch__chevron" aria-hidden="true" strokeWidth={1.9} />
      </div>
    );
  }

  return (
    <div role="group" aria-label="Estudiante" className="gdn-switch">
      {items.map(child => (
        <button
          key={child.id}
          type="button"
          className="gdn-switch__option"
          aria-pressed={child.id === selectedId}
          aria-label={child.courseName ? `${child.name}, ${child.courseName}` : child.name}
          onClick={() => child.id !== selectedId && onSelect(child.id)}
        >
          <span className="gdn-switch__avatar" aria-hidden="true">
            {initialsOf(child.name)}
          </span>
          {firstName(child.name)}
          {child.courseName && <span className="gdn-switch__course">{child.courseName}</span>}
        </button>
      ))}
    </div>
  );
}
