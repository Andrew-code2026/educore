/**
 * PIAR — Plan Individual de Ajustes Razonables (Decreto 1421 de 2017).
 *
 * Estructura de los tres anexos que pide el Ministerio de Educación:
 *   1. Información general del estudiante
 *   2. Plan Individual de Ajustes Razonables
 *   3. Acta de acuerdo
 *
 * Es la única fuente del formulario: el cliente lo dibuja y el servidor calcula
 * con él el avance de cada PIAR, así ambos cuentan los mismos campos.
 */

export type PiarValues = Record<string, string>;

export type PiarFieldType =
  | "text"
  | "date"
  | "number"
  | "select"
  | "radio"
  | "textarea"
  | "heading"
  | "dim"
  | "notice"
  | "linked"
  | "sig"
  | "action";

/** Ubicación del dato original de un campo vinculado. */
export type PiarSource = { annex: number; section: number; label: string };

export interface PiarField {
  type: PiarFieldType;
  /** Clave del valor; solo en campos que se diligencian. */
  key?: string;
  label: string;
  /** Columnas que ocupa en una grilla de 6. */
  span: number;
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  rows?: number;
  /** Orientación del Ministerio para las dimensiones. */
  guide?: string;
  /** El campo solo aplica cuando otro campo tiene ese valor. */
  when?: readonly [key: string, value: string];
  /** Valor calculado de un campo vinculado. */
  get?: (values: PiarValues) => string;
  source?: PiarSource | null;
  /** Encabezado de una actividad en casa que se puede quitar. */
  removable?: boolean;
}

export interface PiarSubsection {
  label: string;
  fields: PiarField[];
}

export interface PiarSection {
  title: string;
  eyebrow: string;
  fields?: PiarField[];
  subs?: PiarSubsection[];
}

export interface PiarAnnex {
  title: string;
  subtitle: string;
  sections: PiarSection[];
}

/** Clave del número de actividades en casa del Anexo 3 (no es un campo). */
export const PIAR_ACTIVITIES_KEY = "__acts";
export const PIAR_DEFAULT_ACTIVITIES = 2;
export const PIAR_MAX_ACTIVITIES = 8;

/** Límites de lo que acepta el servidor al guardar. */
export const PIAR_VALUE_MAX = 4000;
export const PIAR_MAX_KEYS = 800;
export const PIAR_KEY_PATTERN = /^[a-z0-9_]{1,40}$/;

export const PIAR_STATUS = ["DRAFT", "FINALIZED"] as const;
export type PiarStatus = (typeof PIAR_STATUS)[number];

const YN = ["Sí", "No"] as const;
const NIVEL = ["Ninguno", "Primaria", "Bachillerato", "Técnico / Tecnológico", "Universitario", "Posgrado"] as const;
export const PIAR_GRADES = ["Transición", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°", "CLEI"] as const;

const T = (key: string, label: string, span = 3, x: Partial<PiarField> = {}): PiarField => ({ type: "text", key, label, span, ...x });
const D = (key: string, label: string, span = 2, x: Partial<PiarField> = {}): PiarField => ({ type: "date", key, label, span, ...x });
const N = (key: string, label: string, span = 2, x: Partial<PiarField> = {}): PiarField => ({ type: "number", key, label, span, ...x });
const S = (key: string, label: string, options: readonly string[], span = 3, x: Partial<PiarField> = {}): PiarField => ({ type: "select", key, label, options, span, ...x });
const R = (key: string, label: string, options: readonly string[] = YN, span = 3, x: Partial<PiarField> = {}): PiarField => ({ type: "radio", key, label, options, span, ...x });
const TA = (key: string, label: string, span = 6, x: Partial<PiarField> = {}): PiarField => ({ type: "textarea", key, label, span, rows: 3, ...x });
const H = (label: string, x: Partial<PiarField> = {}): PiarField => ({ type: "heading", label, span: 6, ...x });
const DIM = (key: string, label: string, guide: string): PiarField => ({ type: "dim", key, label, guide, span: 6 });
const NOTE = (label: string): PiarField => ({ type: "notice", label, span: 6 });
const L = (label: string, get: (values: PiarValues) => string, source: PiarSource | null, span = 3): PiarField => ({ type: "linked", label, get, source, span });
const SIG = (key: string, label: string, span = 3): PiarField => ({ type: "sig", key, label, span });
const when = (key: string, value: string): Partial<PiarField> => ({ when: [key, value] });

/** Tipos que cuentan para el avance (los vinculados se calculan, no se diligencian). */
const COUNTED: ReadonlySet<PiarFieldType> = new Set(["text", "date", "number", "select", "radio", "textarea", "dim", "sig"]);

/** Edad en años cumplidos a partir de una fecha `AAAA-MM-DD`; vacío si no hay fecha válida. */
export function piarAge(birthDate: string | undefined, now: Date = new Date()): string {
  if (!birthDate) return "";
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  let years = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) years -= 1;
  return years >= 0 ? `${years} años` : "";
}

export const piarFullName = (v: PiarValues) => [v.nombres, v.apellidos].filter(Boolean).join(" ");

export const piarDocument = (v: PiarValues) => {
  if (!v.num_doc) return "";
  const type = v.tipo_doc === "Otro" ? v.tipo_doc_otro || "Otro" : v.tipo_doc || "";
  return `${type} ${v.num_doc}`.trim();
};

export function piarActivityCount(v: PiarValues): number {
  const count = Number.parseInt(v[PIAR_ACTIVITIES_KEY] ?? "", 10);
  if (!Number.isFinite(count)) return PIAR_DEFAULT_ACTIVITIES;
  return Math.min(PIAR_MAX_ACTIVITIES, Math.max(1, count));
}

const FROM_INFO: PiarSource = { annex: 0, section: 1, label: "Del Anexo 1 · Información general" };
const FROM_A2: PiarSource = { annex: 1, section: 0, label: "Del Anexo 2 · Datos generales" };

const AREAS = ["Matemáticas", "Ciencias", "Lenguaje", "Otras", "Convivencia", "Socialización", "Participación", "Autonomía", "Autocontrol"];
const ACTORS = ["Familia, cuidadores o con quienes vive", "Docentes", "Directivos", "Administrativos", "Pares (sus compañeros)"];

/** Los tres anexos con sus secciones y campos; depende de los valores por las actividades en casa. */
export function piarSchema(v: PiarValues): PiarAnnex[] {
  const activities = piarActivityCount(v);
  const home: PiarField[] = [];
  for (let i = 0; i < activities; i++) {
    home.push(H(`Actividad ${i + 1}`, { removable: i === activities - 1 && activities > 1 }));
    home.push(T(`act${i}_nombre`, "Nombre de la actividad", 3));
    home.push(R(`act${i}_frec`, "Frecuencia", ["Diaria", "Semanal", "Permanente"], 3));
    home.push(TA(`act${i}_desc`, "Descripción de la estrategia", 6, { rows: 2 }));
  }
  if (activities < PIAR_MAX_ACTIVITIES) home.push({ type: "action", label: "Agregar actividad", span: 6 });

  return [
    {
      title: "Anexo 1",
      subtitle: "Información general del estudiante",
      sections: [
        {
          title: "Datos de diligenciamiento",
          eyebrow: "Encabezado",
          fields: [
            D("fecha", "Fecha de diligenciamiento", 2),
            T("lugar", "Lugar de diligenciamiento", 4),
            T("dil_nombre", "Nombre de la persona que diligencia", 3),
            T("dil_rol", "Rol que desempeña en la SE o la IE", 3, { placeholder: "Ej. docente de apoyo, orientador" }),
          ],
        },
        {
          title: "Información general del estudiante",
          eyebrow: "Sección 1",
          fields: [
            T("nombres", "Nombres"),
            T("apellidos", "Apellidos"),
            T("lugar_nac", "Lugar de nacimiento", 2),
            D("fecha_nac", "Fecha de nacimiento", 2),
            L("Edad", values => piarAge(values.fecha_nac), null, 2),
            R("tipo_doc", "Tipo de documento", ["TI", "CC", "RC", "Otro"]),
            T("num_doc", "No. de identificación"),
            T("tipo_doc_otro", "¿Cuál?", 3, when("tipo_doc", "Otro")),
            NOTE("Si el estudiante no tiene registro civil debe iniciarse la gestión con la familia y la Registraduría."),
            T("depto", "Departamento donde vive"),
            T("municipio", "Municipio"),
            T("direccion", "Dirección de vivienda"),
            T("barrio", "Barrio / vereda"),
            T("correo", "Correo electrónico", 6, { placeholder: "correo@ejemplo.com" }),
            R("centro_prot", "¿Está en centro de protección?"),
            T("centro_donde", "¿Dónde?", 3, when("centro_prot", "Sí")),
            S("grado", "Grado al que aspira ingresar", PIAR_GRADES),
            R("etnico", "¿Se reconoce o pertenece a un grupo étnico?"),
            T("etnico_cual", "¿Cuál?", 3, when("etnico", "Sí")),
            R("victima", "¿Se reconoce como víctima del conflicto armado?"),
            R("victima_reg", "¿Cuenta con el respectivo registro?", YN, 3, when("victima", "Sí")),
          ],
        },
        {
          title: "Entorno hogar",
          eyebrow: "Sección 2",
          fields: [
            H("Madre"),
            T("madre_nombre", "Nombre de la madre"),
            T("madre_ocup", "Ocupación de la madre"),
            R("madre_vive", "Vive con el estudiante", YN, 2),
            T("madre_contacto", "Contacto", 2),
            S("madre_nivel", "Nivel educativo alcanzado", NIVEL, 2),
            H("Padre"),
            T("padre_nombre", "Nombre del padre"),
            T("padre_ocup", "Ocupación del padre"),
            R("padre_vive", "Vive con el estudiante", YN, 2),
            T("padre_contacto", "Contacto", 2),
            S("padre_nivel", "Nivel educativo alcanzado", NIVEL, 2),
            H("Cuidador"),
            T("cuid_nombre", "Nombre del cuidador"),
            T("cuid_parentesco", "Parentesco con el estudiante"),
            S("cuid_nivel", "Nivel educativo del cuidador", NIVEL, 2),
            T("cuid_tel", "Teléfono", 2),
            T("cuid_correo", "Correo electrónico", 2),
            H("Composición familiar"),
            N("hermanos", "No. de hermanos", 2),
            T("lugar_ocupa", "Lugar que ocupa", 2),
            R("bajo_prot", "¿Está bajo protección?", YN, 2),
            T("apoyan", "¿Quiénes apoyan la crianza del estudiante?"),
            T("vive_con", "Personas con quien vive"),
            R("subsidio", "La familia recibe algún subsidio de alguna entidad o institución"),
            T("subsidio_cual", "¿Cuál?", 3, when("subsidio", "Sí")),
            DIM(
              "dim_familia",
              "Contexto y vida familiar",
              "Aquí se recogen datos generales del estudiante, su familia y cuidadores y todo aquello relevante al entorno inmediato en el que vive. Debe documentarse con quién vive, en qué condiciones (materiales y afectivas), cómo son las relaciones actuales del estudiante con sus familiares, quién se encarga de su cuidado, entre otros. También debe recogerse información sobre situaciones traumáticas o difíciles que haya enfrentado la familia y que puedan tener un efecto en la vida del estudiante y en su desarrollo (p. ej.: desplazamiento forzoso, violencia intrafamiliar, muerte de algún ser querido, separación de los padres, etc.).",
            ),
          ],
        },
        {
          title: "Entorno salud",
          eyebrow: "Sección 3",
          fields: [
            R("afiliacion", "Afiliación al sistema de salud", YN, 2),
            T("eps", "EPS", 2, when("afiliacion", "Sí")),
            R("regimen", "Régimen", ["Contributivo", "Subsidiado"], 2, when("afiliacion", "Sí")),
            T("emergencia", "Lugar donde le atienden en caso de emergencia", 6),
            R("atendido", "¿El niño está siendo atendido por el sector salud?"),
            T("atendido_frec", "Frecuencia", 3, when("atendido", "Sí")),
            R("diagnostico", "Tiene diagnóstico médico"),
            T("diagnostico_cual", "¿Cuál?", 3, when("diagnostico", "Sí")),
            R("terapias", "¿El niño está asistiendo a terapias?", YN, 6),
            T("ter1", "Terapia 1 · ¿Cuál?", 3, when("terapias", "Sí")),
            T("ter1_f", "Frecuencia", 3, when("terapias", "Sí")),
            T("ter2", "Terapia 2 · ¿Cuál?", 3, when("terapias", "Sí")),
            T("ter2_f", "Frecuencia", 3, when("terapias", "Sí")),
            T("ter3", "Terapia 3 · ¿Cuál?", 3, when("terapias", "Sí")),
            T("ter3_f", "Frecuencia", 3, when("terapias", "Sí")),
            R("tratamiento", "¿Actualmente recibe tratamiento médico por alguna enfermedad en particular?"),
            T("tratamiento_cual", "¿Cuál?", 3, when("tratamiento", "Sí")),
            R("farmaco", "¿Tratamiento farmacológico?"),
            T("farmaco_frec", "Frecuencia y horario", 3, when("farmaco", "Sí")),
            R("productos", "¿Cuenta con productos de apoyo para favorecer su movilidad, comunicación e independencia?"),
            T("productos_cual", "¿Cuáles?", 3, when("productos", "Sí")),
            DIM(
              "dim_salud",
              "Salud y bienestar físico",
              "Aquí es fundamental recoger el diagnóstico que el estudiante tenga, si hay un informe que lo respalde, qué se trabaja y cómo se apoya al estudiante en servicios terapéuticos externos (neuropsicología, terapia ocupacional, fonoaudiología, psicología, psiquiatría). También es importante conocer si el estudiante tiene tratamiento farmacológico, sus posibles efectos secundarios, cómo se maneja en casa y qué cuidados deben tenerse en el medio escolar a este respecto.",
            ),
          ],
        },
        {
          title: "Bienestar emocional",
          eyebrow: "Sección 4",
          fields: [
            R("normas_edu", "¿Acata normas dentro del contexto educativo?"),
            R("normas_fam", "¿Acata normas dentro del contexto familiar?"),
            R("animo", "Estado de ánimo", ["Bajo", "Fluctuante", "Estable"]),
            R("pares", "¿Cómo es la relación con sus pares?", ["Buena", "Regular", "Mala"]),
            DIM(
              "dim_emocional",
              "Bienestar emocional",
              "Aquí se recoge información sobre la autoestima del estudiante, la percepción que tiene sobre su propia vida, la ausencia (o presencia) de sentimientos negativos con respecto a quién es, lo que ha logrado y lo que no. También se compila información sobre sus estrategias de afrontamiento cuando debe asumir situaciones difíciles (cómo maneja la pérdida, el fracaso, el conflicto, qué relación tiene con la autoridad y cómo agencia el cumplimiento de la norma, entre otros).",
            ),
            DIM(
              "dim_adaptativa",
              "Conducta adaptativa y desarrollo personal",
              "En esta dimensión se recopila información sobre las habilidades sociales y prácticas que son indispensables para una vida autónoma e independiente. A modo general, deben recogerse aquí todos los apoyos que el estudiante emplee para cualificar su visión, audición o movilidad en la vida diaria (audífonos, anteojos, silla de ruedas, bastón, caminador, etc.). En cuanto a las habilidades sociales, es vital conocer si el estudiante sabe cuáles son las normas y las reglas escolares, reconoce escenarios en los que se cumplen y cuándo se rompen y tiene adecuadas habilidades para relacionarse con pares y adultos. Otro aspecto relevante en cuanto a las habilidades prácticas, es determinar si el estudiante puede ocuparse, según como sea esperado para su edad y entorno cultural, de su cuidado personal (aseo, alimentación y vestido).",
            ),
          ],
        },
        {
          title: "Entorno educativo",
          eyebrow: "Sección 5",
          fields: [
            H("Información de la trayectoria educativa"),
            R("vinculado", "¿Ha estado vinculado en otra institución educativa, fundación o modalidad de educación inicial?", YN, 6),
            T("vinculado_cuales", "¿Cuáles?", 6, when("vinculado", "Sí")),
            T("vinculado_porque", "¿Por qué?", 6, when("vinculado", "No")),
            S("ultimo_grado", "Último grado cursado", PIAR_GRADES, 2),
            R("aprobo", "¿Aprobó?", YN, 2),
            T("obs_grado", "Observaciones", 2),
            R("informe", "¿Se recibe informe pedagógico cualitativo que describa el proceso de desarrollo y aprendizaje del estudiante y/o PIAR?"),
            T("informe_inst", "¿De qué institución o modalidad proviene el informe?", 3, when("informe", "Sí")),
            R("complementarios", "¿Está asistiendo en la actualidad a programas complementarios?"),
            T("complementarios_cuales", "¿Cuáles?", 3, when("complementarios", "Sí")),
            R("extra", "¿Asiste a actividades extracurriculares?"),
            T("extra_cuales", "¿Cuáles?", 3, when("extra", "Sí")),
            DIM(
              "dim_participacion",
              "Participación e inclusión social",
              "En esta dimensión es esencial reconocer las redes y los grupos en los que el estudiante participa, cómo se desenvuelve en estos, con qué apoyos comunitarios y de familia extensa cuenta, y si se siente parte activa (o no) de la vida en sociedad.",
            ),
          ],
        },
        {
          title: "Habilidades intelectuales",
          eyebrow: "Sección 5 · Dimensión habilidades intelectuales",
          fields: [
            NOTE("Percepción de los maestros de aula con respecto al rendimiento del estudiante en su asignatura, en términos de las siguientes capacidades."),
            DIM(
              "hi_atencion",
              "Atención",
              "Si el estudiante puede centrar de forma específica el foco atencional en aquellos elementos del ambiente relevantes para las actividades que debe desarrollar; si consigue reorientar la atención cuando se distrae; si se mantiene concentrado en actividades de ciclo largo (clases o talleres); si puede atender a varias fuentes de estímulos (el discurso del profesor, sus apuntes en el tablero, etc.), sin perder el hilo de la tarea que está desarrollando; si sigue instrucciones sin necesidad de mayor repetición.",
            ),
            DIM(
              "hi_memoria",
              "Memoria",
              "Si el estudiante recuerda los conocimientos aprendidos sin mayor dificultad; si evidencia un vocabulario enriquecido y una red de conceptos amplia; si vincula sus experiencias personales con lo que aborda en el aula.",
            ),
            DIM(
              "hi_razonamiento",
              "Procesos de razonamiento",
              "Si el estudiante es hábil para plantear hipótesis o explicaciones frente a diversos fenómenos; si en estas hipótesis integra sus conocimientos previos; si sigue un procedimiento acorde con lo esperado para resolver problemas; si es capaz de transferir o usar un conocimiento que le es familiar o que ya domina, para explicar fenómenos poco conocidos; si en los debates o discusiones de clase presenta argumentos claros y concisos sobre lo que piensa y reconoce argumentos en contra o a favor de los suyos; si es capaz de organizar, jerarquizar y relacionar apropiadamente los conceptos que ha aprendido sobre un tema particular.",
            ),
            DIM(
              "hi_lectoescritura",
              "Competencias de lectura y escritura",
              "Si el estudiante lee con fluidez, respetando los signos de puntuación y con una entonación adecuada; si puede identificar los argumentos e ideas principales en lo que lee y realiza inferencias de los textos, usando sus conocimientos previos para ello; si su escritura es correcta y no hay omisión o adición de letras, sílabas o palabras; si sus escritos presentan ideas claras y tienen un hilo conductor que pueda rastrearse sin mayor dificultad.",
            ),
            DIM(
              "hi_ejecutivas",
              "Funciones ejecutivas",
              "Si organiza su tiempo para poder cumplir con las tareas escolares; si planifica lo que piensa desarrollar y busca los medios para lograrlo; si es flexible frente a los cambios e imprevistos; si considera diversas rutas para resolver una tarea dada y elige la más adecuada; si tiene estrategias de monitoreo y seguimiento de sus acciones, y reconoce cuándo debe modificar lo que ha planeado o cuándo comete errores y cómo corregirlos; si puede anticipar qué hará frente a determinada situación y lo implementa llegado el momento.",
            ),
            DIM(
              "hi_lenguaje",
              "Lenguaje y comunicación",
              "Qué vía de comunicación emplea el estudiante (español, lengua de señas); si le es fácil acomodarse a intercambios comunicativos con otros y puede seguir sin dificultad el hilo de las conversaciones; si establece contacto ocular y se interesa por lo que propone el interlocutor; si interpreta adecuadamente dobles sentidos que son familiares en su entorno cultural (chistes, frases hechas, dichos populares, etc.); si tiene un sentido del humor apropiado para su edad; si utiliza frases muy elaboradas (o, al contrario, poco estructuradas) para comunicarse.",
            ),
            DIM(
              "hi_contenidos",
              "Dominio de contenidos específicos",
              "Si el estudiante se ha apropiado de los conocimientos de la asignatura, con respecto a lo que debería saber, y puede dar cuenta de ellos en distintos contextos y aplicarlos en las actividades que se le proponen.",
            ),
          ],
        },
      ],
    },
    {
      title: "Anexo 2",
      subtitle: "Plan Individual de Ajustes Razonables",
      sections: [
        {
          title: "Datos generales",
          eyebrow: "Encabezado",
          fields: [
            D("a2_fecha", "Fecha de elaboración", 2),
            T("a2_inst", "Institución educativa", 4),
            T("a2_sede", "Sede"),
            S("a2_jornada", "Jornada", ["Mañana", "Tarde", "Única", "Nocturna", "Fin de semana"]),
            TA("a2_docentes", "Docentes, facilitadores o maestros en formación (ENS) que elaboran y cargo", 6, { rows: 2, placeholder: "Nombre — cargo" }),
            H("Datos del estudiante"),
            L("Nombre del estudiante", piarFullName, FROM_INFO),
            L("Documento de identificación", piarDocument, FROM_INFO),
            L("Edad", values => piarAge(values.fecha_nac), FROM_INFO),
            T("a2_clei", "Ciclo lectivo especial integrado"),
          ],
        },
        {
          title: "Características del estudiante",
          eyebrow: "Sección 1",
          fields: [
            TA("a2_c1", "Descripción general del estudiante con énfasis en gustos e intereses o aspectos que le desagradan, expectativas del estudiante y la familia.", 6, { rows: 4 }),
            TA("a2_c2", "Descripción en términos de lo que hace, puede hacer o requiere apoyo el estudiante para favorecer su proceso educativo.", 6, { rows: 4 }),
            TA("a2_c3", "Indique las habilidades, competencias, cualidades, aprendizajes con las que cuenta el estudiante para el grado en el que fue matriculado.", 6, { rows: 4 }),
          ],
        },
        {
          title: "Ajustes razonables",
          eyebrow: "Sección 2",
          subs: AREAS.map((area, i) => ({
            label: area,
            fields: [
              H(area, { hint: i < 4 ? "Área / aprendizaje" : "Aprendizaje transversal" }),
              TA(`aj${i}_obj`, "Objetivos / propósitos", 6, { hint: "Son para todo el grado, de acuerdo con los EBC y DBA." }),
              TA(`aj${i}_bar`, "Barreras que se evidencian en el contexto sobre las que se deben trabajar"),
              TA(`aj${i}_aj`, "Ajustes razonables (apoyos / estrategias)"),
              H("Evaluación de los ajustes", { hint: "Seguimiento mínimo 3 veces en el año, de acuerdo con la periodicidad establecida en el SIEE." }),
              TA(`aj${i}_e1`, "Seguimiento 1", 2, { rows: 3 }),
              TA(`aj${i}_e2`, "Seguimiento 2", 2, { rows: 3 }),
              TA(`aj${i}_e3`, "Seguimiento 3", 2, { rows: 3 }),
              ...(i === 0
                ? [NOTE("Para educación inicial y preescolar, los propósitos se orientarán de acuerdo con las bases curriculares para la educación inicial y los DBA de transición, que no son por áreas ni asignaturas.")]
                : []),
            ],
          })),
        },
        {
          title: "Recomendaciones para el plan de mejoramiento institucional",
          eyebrow: "Sección 7",
          fields: [
            NOTE("Recomendaciones para la eliminación de barreras y la creación de procesos para la participación, el aprendizaje y el progreso de los estudiantes."),
            ...ACTORS.flatMap((actor, i) => [H(actor), TA(`rec${i}_acc`, "Acciones", 3), TA(`rec${i}_est`, "Estrategias a implementar", 3)]),
          ],
        },
        {
          title: "Firmas de la valoración",
          eyebrow: "Cierre",
          fields: [
            NOTE("Firma y cargo de quienes realizan el proceso de valoración: docentes, coordinadores, docente de apoyo u otro profesional."),
            ...[1, 2, 3].flatMap(n => [H(`Firmante ${n}`), T(`f${n}_nombre`, "Nombre", 2), T(`f${n}_area`, "Área", 2), SIG(`f${n}_firma`, "Firma", 2)]),
          ],
        },
      ],
    },
    {
      title: "Anexo 3",
      subtitle: "Acta de acuerdo",
      sections: [
        {
          title: "Datos del acta",
          eyebrow: "Encabezado",
          fields: [
            D("a3_fecha", "Fecha", 2),
            L("Institución educativa y sede", values => [values.a2_inst, values.a2_sede].filter(Boolean).join(" · "), FROM_A2, 4),
            L("Nombre del estudiante", piarFullName, FROM_INFO),
            L("Documento de identificación", piarDocument, FROM_INFO),
            L("Edad", values => piarAge(values.fecha_nac), FROM_INFO),
            L("Grado", values => values.grado || "", FROM_INFO),
            TA("a3_equipo", "Nombres equipo directivos y de docentes o facilitadores o docentes en formación (ENS)", 6, { rows: 2 }),
          ],
        },
        {
          title: "Compromisos",
          eyebrow: "Acuerdo",
          fields: [
            NOTE("Según el Decreto 1421 de 2017 la educación inclusiva es un proceso permanente que reconoce, valora y responde a la diversidad de características, intereses, posibilidades y expectativas de los estudiantes para promover su desarrollo, aprendizaje y participación, en un ambiente de aprendizaje común, sin discriminación o exclusión. La inclusión solo es posible cuando se unen los esfuerzos de la institución educativa, el estudiante y la familia. De ahí la importancia de formalizar con las firmas, la presente Acta Acuerdo."),
            NOTE("El Establecimiento Educativo ha realizado la valoración y definido los ajustes razonables que facilitarán al estudiante su proceso educativo."),
            TA("a3_familia", "La Familia se compromete a cumplir y firmar los compromisos señalados en el PIAR y en las actas de acuerdo, para fortalecer los procesos escolares del estudiante y en particular a:", 6, { rows: 4 }),
            TA("a3_aula", "Compromisos específicos para implementar en el aula que requieran ampliación o detalle adicional al incluido en el PIAR.", 6, { rows: 4 }),
          ],
        },
        { title: "Actividades en casa", eyebrow: "En casa apoyará con las siguientes actividades", fields: home },
        {
          title: "Firmas de los actores comprometidos",
          eyebrow: "Cierre",
          fields: [SIG("a3_sig_est", "Estudiante"), SIG("a3_sig_fam", "Acudiente / familia"), SIG("a3_sig_doc", "Docentes"), SIG("a3_sig_dir", "Directivo docente")],
        },
      ],
    },
  ];
}

export const isPiarFieldVisible = (field: PiarField, v: PiarValues) => !field.when || v[field.when[0]] === field.when[1];

export const piarSectionFields = (section: PiarSection): PiarField[] => (section.subs ? section.subs.flatMap(sub => sub.fields) : section.fields ?? []);

export type PiarStats = { done: number; total: number };

/** Campos diligenciados sobre los que aplican (los condicionales ocultos no cuentan). */
export function piarFieldStats(fields: PiarField[], v: PiarValues): PiarStats {
  let done = 0;
  let total = 0;
  for (const field of fields) {
    if (!field.key || !COUNTED.has(field.type) || !isPiarFieldVisible(field, v)) continue;
    total += 1;
    if ((v[field.key] ?? "").trim() !== "") done += 1;
  }
  return { done, total };
}

export const piarPercent = ({ done, total }: PiarStats) => (total ? Math.round((done / total) * 100) : 0);

export type PiarProgress = {
  /** Avance de cada anexo, en orden. */
  annexes: Array<PiarStats & { pct: number }>;
  done: number;
  total: number;
  pct: number;
};

export function piarProgress(v: PiarValues): PiarProgress {
  const annexes = piarSchema(v).map(annex => {
    const stats = piarFieldStats(annex.sections.flatMap(piarSectionFields), v);
    return { ...stats, pct: piarPercent(stats) };
  });
  const done = annexes.reduce((sum, annex) => sum + annex.done, 0);
  const total = annexes.reduce((sum, annex) => sum + annex.total, 0);
  return { annexes, done, total, pct: piarPercent({ done, total }) };
}

/** Deja solo claves y valores válidos; el servidor lo aplica antes de guardar. */
export function sanitizePiarValues(input: Record<string, unknown>): PiarValues {
  const clean: PiarValues = {};
  let count = 0;
  for (const [key, raw] of Object.entries(input)) {
    if (count >= PIAR_MAX_KEYS) break;
    if (!(PIAR_KEY_PATTERN.test(key) || key === PIAR_ACTIVITIES_KEY) || typeof raw !== "string") continue;
    const value = raw.slice(0, PIAR_VALUE_MAX);
    if (value === "") continue;
    clean[key] = value;
    count += 1;
  }
  return clean;
}
