import type { Dba } from "../types";

export interface CatalogDba extends Dba {
  grade: number;
  subjectCode: string;
  subjectName: string;
  number: number;
  dimension: "cognitivo" | "procedimental" | "actitudinal";
  evidences: string[];
}

/**
 * Catálogo Oficial de Derechos Básicos de Aprendizaje (DBA)
 * Ministerio de Educación Nacional (MEN) - República de Colombia.
 *
 * Incluye grados de Básica Secundaria y Media (6° a 11°) para
 * Ciencias Naturales, Matemáticas, Lenguaje, Ciencias Sociales e Inglés.
 */
export const OFFICIAL_DBA_CATALOG: CatalogDba[] = [
  // ==========================================
  // GRADO 11° - CIENCIAS NATURALES (BIOLOGÍA)
  // ==========================================
  {
    id: "men-cn-11-1",
    grade: 11,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Biología",
    number: 1,
    code: "DBA 1",
    title: "Herencia, mutaciones y variabilidad genética",
    statement:
      "Explica la forma como se transmite la información genética en las poblaciones, teniendo en cuenta las leyes mendelianas, las mutaciones moleculares y los patrones de herencia no mendeliana.",
    dimension: "cognitivo",
    evidences: [
      "Predice la probabilidad de aparición de fenotipos y genotipos a partir de cruces monohíbridos y dihíbridos.",
      "Identifica los diferentes tipos de mutaciones cromosómicas y moleculares y su impacto en la variabilidad biológica.",
      "Reconoce aplicaciones y dilemas bioéticos de la ingeniería genética y la clonación en la sociedad contemporánea.",
    ],
  },
  {
    id: "men-cn-11-2",
    grade: 11,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Biología",
    number: 2,
    code: "DBA 2",
    title: "Evolución, selección natural y especiación",
    statement:
      "Analiza teorías sobre el origen de las especies y los mecanismos evolutivos (selección natural, deriva génica y flujo genético) que explican la biodiversidad actual y el registro fósil.",
    dimension: "cognitivo",
    evidences: [
      "Compara los modelos evolutivos de Lamarck y Darwin-Wallace con la síntesis moderna de la evolución.",
      "Modela cómo las presiones de selección ambiental inducen cambios en las frecuencias alélicas de una población.",
      "Interpreta cladogramas y árboles filogenéticos para deducir parentescos evolutivos entre grupos biológicos.",
    ],
  },
  {
    id: "men-cn-11-3",
    grade: 11,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Biología",
    number: 3,
    code: "DBA 3",
    title: "Dinámica de ecosistemas y ciclos biogeoquímicos",
    statement:
      "Evalúa el flujo de energía y los ciclos biogeoquímicos (carbono, nitrógeno, fósforo) en ecosistemas complejos y analiza el impacto de las actividades antrópicas en el cambio climático.",
    dimension: "procedimental",
    evidences: [
      "Calcula balances energéticos y eficiencias tróficas en cadenas y redes ecológicas regionales.",
      "Sustenta hipótesis sobre las consecuencias de la eutrofización y la deforestación en la resiliencia de biomas locales.",
      "Diseña estrategias sostenibles y planes de mitigación frente a la huella ecológica institucional.",
    ],
  },
  {
    id: "men-cn-11-4",
    grade: 11,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Biología",
    number: 4,
    code: "DBA 4",
    title: "Bioseguridad, ética ambiental y compromiso ciudadano",
    statement:
      "Asume una postura crítica y responsable frente al manejo de recursos naturales, el consumo sustentable y el cumplimiento de protocolos de seguridad en el laboratorio.",
    dimension: "actitudinal",
    evidences: [
      "Cumple rigurosamente las normas de bioseguridad y gestión de residuos biológicos en prácticas experimentales.",
      "Participa activamente en debates sobre conservación de ecosistemas estratégicos de Colombia (páramos y humedales).",
      "Demuestra autonomía, rigurosidad metodológica y trabajo colaborativo en indagaciones de campo.",
    ],
  },

  // ==========================================
  // GRADO 11° - MATEMÁTICAS
  // ==========================================
  {
    id: "men-mat-11-1",
    grade: 11,
    subjectCode: "matematicas",
    subjectName: "Matemáticas",
    number: 1,
    code: "DBA 1",
    title: "Límites, continuidad y aproximación funcional",
    statement:
      "Utiliza las propiedades de los números reales para fundamentar los conceptos de convergencia, sucesiones, límites de funciones y continuidad en problemas de cálculo diferencial.",
    dimension: "cognitivo",
    evidences: [
      "Calcula límites algebraicos y trigonométricos reconociendo formas indeterminadas y su resolución.",
      "Determina la continuidad de una función en un punto y en un intervalo aplicando definiciones formales.",
      "Interpreta asíntotas verticales y horizontales en contextos físicos y económicos.",
    ],
  },
  {
    id: "men-mat-11-2",
    grade: 11,
    subjectCode: "matematicas",
    subjectName: "Matemáticas",
    number: 2,
    code: "DBA 2",
    title: "La derivada como razón de cambio y optimización",
    statement:
      "Interpreta y aplica la derivada como la razón de cambio instantánea de una función para modelar situaciones de optimización, concavidad y movimiento uniforme acelerado.",
    dimension: "procedimental",
    evidences: [
      "Calcula derivadas empleando reglas de derivación (cadena, producto, cociente) con solvencia técnica.",
      "Resuelve problemas de optimización geométrica y económica hallando máximos y mínimos locales.",
      "Grafica curvas analizando puntos críticos, intervalos de crecimiento y puntos de inflexión.",
    ],
  },
  {
    id: "men-mat-11-3",
    grade: 11,
    subjectCode: "matematicas",
    subjectName: "Matemáticas",
    number: 3,
    code: "DBA 3",
    title: "Inferencia estadística y distribuciones de probabilidad",
    statement:
      "Plantea y resuelve problemas que requieren el uso de distribuciones de probabilidad continuas (Normal y t-Student) e intervalos de confianza para tomar decisiones sustentadas.",
    dimension: "cognitivo",
    evidences: [
      "Estandariza variables aleatorias y halla probabilidades bajo la curva normal estándar.",
      "Formula e interpreta intervalos de confianza para la media poblacional a partir de muestras aleatorias.",
    ],
  },

  // ==========================================
  // GRADO 6° - CIENCIAS NATURALES (Foto Ciudad Educativa)
  // ==========================================
  {
    id: "men-cn-6-1",
    grade: 6,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Ed. Ambiental",
    number: 1,
    code: "DBA 1",
    title: "Estructura celular y niveles de organización biológica",
    statement:
      "Comprende que los seres vivos están constituidos por una o más células, y que cada una realiza funciones vitales gracias a la interacción de sus organelos especializados.",
    dimension: "cognitivo",
    evidences: [
      "Diferencia células procariotas y eucariotas (animal y vegetal) a partir de sus organelos y funciones.",
      "Explica la relación entre tejidos, órganos, sistemas y organismos en la escala de complejidad biológica.",
      "Realiza montajes microscópicos siguiendo protocolos de laboratorio para identificar células de cebolla o epitelio.",
    ],
  },
  {
    id: "men-cn-6-2",
    grade: 6,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Ed. Ambiental",
    number: 2,
    code: "DBA 2",
    title: "Cargas eléctricas, atracción y repulsión en la materia",
    statement:
      "Comprende cómo los cuerpos pueden cargarse eléctricamente por fricción, contacto o inducción, y explica las fuerzas de atracción y repulsión eléctrica en situaciones cotidianas.",
    dimension: "cognitivo",
    evidences: [
      "Identifica ejemplos cotidianos de atracción y repulsión electrostática (fricción de globos, peine y cabello).",
      "Describe cómo se transfieren electrones entre objetos aislantes y conductores de electricidad.",
      "Diseña montajes sencillos como electroscopios para evidenciar la presencia de carga eléctrica.",
    ],
  },
  {
    id: "men-cn-6-3",
    grade: 6,
    subjectCode: "ciencias",
    subjectName: "Ciencias Naturales y Ed. Ambiental",
    number: 3,
    code: "DBA 3",
    title: "Propiedades de la materia, puntos de ebullición y mezclas",
    statement:
      "Clasifica sustancias puras y mezclas (homogéneas y heterogéneas) y relaciona los cambios de estado con la temperatura, la presión y los métodos físicos de separación.",
    dimension: "procedimental",
    evidences: [
      "Explica cómo la variación de la presión atmosférica altera los puntos de ebullición y fusión del agua.",
      "Aplica métodos de separación de mezclas (filtración, decantación, evaporación) en experiencias de laboratorio.",
      "Registra datos sistemáticos de temperatura y solubilidad elaborando tablas y gráficos comparativos.",
    ],
  },

  // ==========================================
  // GRADO 10° - LENGUAJE / ESPAÑOL
  // ==========================================
  {
    id: "men-len-10-1",
    grade: 10,
    subjectCode: "lenguaje",
    subjectName: "Lengua Castellana y Literatura",
    number: 1,
    code: "DBA 1",
    title: "Análisis crítico y estilístico de la literatura clásica y medieval",
    statement:
      "Caracteriza la literatura en un momento particular de la historia (desde la Antigüedad hasta el Renacimiento), reconociendo sus cosmovisiones, tropos y recursos retóricos.",
    dimension: "cognitivo",
    evidences: [
      "Identifica rasgos del héroe clásico y medieval en obras como la Ilíada y el Cantar de Mio Cid.",
      "Redacta ensayos argumentativos con tesis clara, contraargumentos y citas en normas académicas.",
    ],
  },
  {
    id: "men-len-10-2",
    grade: 10,
    subjectCode: "lenguaje",
    subjectName: "Lengua Castellana y Literatura",
    number: 2,
    code: "DBA 2",
    title: "Producción de discursos y debate argumentativo",
    statement:
      "Participa en discursos orales formales (debates, foros, ponencias) empleando argumentos de autoridad, ejemplificación y analogía, manteniendo la escucha activa y la asertividad.",
    dimension: "actitudinal",
    evidences: [
      "Sustenta sus puntos de vista con respeto y tolerancia frente a posturas disidentes.",
      "Adecúa el registro lingüístico y la modulación vocal a auditorios formales.",
    ],
  },
];

/**
 * Filtra el catálogo por grado y materia aproximada.
 */
export function queryCatalog(grade?: number, subjectKeyword?: string): CatalogDba[] {
  let list = OFFICIAL_DBA_CATALOG;
  if (grade !== undefined && grade > 0) {
    list = list.filter((item) => item.grade === grade);
  }
  if (subjectKeyword) {
    const kw = subjectKeyword.toLowerCase().trim();
    list = list.filter(
      (item) =>
        item.subjectCode.includes(kw) ||
        item.subjectName.toLowerCase().includes(kw) ||
        item.title.toLowerCase().includes(kw) ||
        item.statement.toLowerCase().includes(kw)
    );
  }
  return list;
}
