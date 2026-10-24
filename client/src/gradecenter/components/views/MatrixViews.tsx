import { MatrixCanvas } from "../matrix/MatrixCanvas";

/** Vista Planilla: la matriz de calificaciones. */
export function StandardView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MatrixCanvas />
    </div>
  );
}
