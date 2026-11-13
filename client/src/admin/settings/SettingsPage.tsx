import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { CalendarRange, Check, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { EduRole } from "@/components/shell";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import {
  AdminHeader,
  AdminPage,
  EmptyState,
  Field,
  Pill,
  Segment,
  formatShortDate,
  plural,
  type SegmentOption,
  type Tone,
} from "../parts";
import "./settings.css";

type SettingsTab = "institution" | "appearance" | "periods";

const TABS: SegmentOption<SettingsTab>[] = [
  { value: "institution", label: "Institución" },
  { value: "appearance", label: "Apariencia" },
  { value: "periods", label: "Año y periodos" },
];

const BORDER_RADIUS_OPTIONS: SelectOption[] = [
  { value: "8px", label: "Compacto" },
  { value: "12px", label: "Suave" },
  { value: "16px", label: "Amplio" },
];

const THEME_MODE_OPTIONS: SelectOption[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const PERIOD_TONE: Record<string, Tone> = { Activo: "green", Programado: "blue", Cerrado: "neutral" };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp"];
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const WEEK_MS = 7 * 86_400_000;
const THREE_COLUMNS = { ["--adm-cols" as string]: 3 } as CSSProperties;

const storageUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return value.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment))).join("/");
};

/** `<input type="color">` solo acepta #rrggbb; mientras se escribe el hex se mantiene el último color válido. */
const swatchValue = (value: string) => (HEX_COLOR.test(value) ? value : "#000000");

const weeksBetween = (start: Date | string | null | undefined, end: Date | string | null | undefined) => {
  if (!start || !end) return null;
  const weeks = Math.round((new Date(end).getTime() - new Date(start).getTime()) / WEEK_MS);
  return Number.isFinite(weeks) && weeks > 0 ? weeks : null;
};

function PanelHead({ id, title, sub, children }: { id: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="adm-panel__head">
      <div>
        <h2 id={id} className="adm-panel__title">{title}</h2>
        {sub ? <p className="adm-panel__sub">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage({ data, role, onChanged }: { data: any; role: EduRole; onChanged: () => void }) {
  const canEdit = role === "admin";
  const [tab, setTab] = useState<SettingsTab>("institution");
  const school = data?.school ?? {};
  const [name, setName] = useState<string>(school.name ?? "");
  const [shortName, setShortName] = useState<string>(school.shortName ?? "EduCore");
  const [city, setCity] = useState<string>(school.city ?? "");
  const [department, setDepartment] = useState<string>(school.department ?? "Valle del Cauca");
  const [country, setCountry] = useState<string>(school.country ?? "Colombia");
  const [description, setDescription] = useState<string>(school.description ?? "Plataforma institucional para centralizar la vida académica.");
  const [website, setWebsite] = useState<string>(school.website ?? "https://educore.co");
  const [email, setEmail] = useState<string>(school.email ?? "contacto@educore.co");
  const [phone, setPhone] = useState<string>(school.phone ?? "+57 602 555 0101");
  const [address, setAddress] = useState<string>(school.address ?? "Cali, Valle del Cauca");
  const [academicYear, setAcademicYear] = useState<string>(school.academicYear ?? "");
  const [primaryColor, setPrimaryColor] = useState<string>(school.primaryColor ?? "#2475cf");
  const [secondaryColor, setSecondaryColor] = useState<string>(school.secondaryColor ?? "#eaf4ff");
  const [accentColor, setAccentColor] = useState<string>(school.accentColor ?? "#8ec6fa");
  const [backgroundColor, setBackgroundColor] = useState<string>(school.backgroundColor ?? "#f7f9fc");
  const [surfaceColor, setSurfaceColor] = useState<string>(school.surfaceColor ?? "#ffffff");
  const [textColor, setTextColor] = useState<string>(school.textColor ?? "#182131");
  const [mutedTextColor, setMutedTextColor] = useState<string>(school.mutedTextColor ?? "#7a8798");
  const [themeMode, setThemeMode] = useState<string>(school.themeMode ?? "light");
  const [borderRadius, setBorderRadius] = useState<string>(school.borderRadius ?? "12px");
  const [logoUrl, setLogoUrl] = useState<string | null>(school.logoUrl ?? null);
  const [suggestedPalette, setSuggestedPalette] = useState<{ primary: string; secondary: string; accent: string } | null>(null);
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  useEffect(() => {
    if (school.logoUrl !== undefined) {
      setLogoUrl(school.logoUrl ?? null);
    }
  }, [school.logoUrl]);

  const schoolMutation = trpc.educore.updateSchool.useMutation({
    onSuccess: () => {
      toast.success("Información institucional guardada correctamente.");
      onChanged();
    },
    onError: (error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  const uploadMutation = trpc.educore.uploadSchoolLogo.useMutation({
    onSuccess: (result) => {
      setLogoUrl(result.logoUrl ?? null);
      toast.success("Escudo actualizado correctamente.");
      onChanged();
    },
    onError: (error) => {
      setLogoUrl(school.logoUrl ?? null);
      toast.error(`No se pudo subir el escudo: ${error.message}`);
    },
  });

  const periodMutation = trpc.educore.createAcademicPeriod.useMutation({
    onSuccess: () => {
      toast.success("Periodo creado correctamente.");
      setPeriodName("");
      setPeriodStart("");
      setPeriodEnd("");
      onChanged();
    },
    onError: (error) => {
      toast.error(`No se pudo crear el periodo: ${error.message}`);
    },
  });

  const schoolPayload = (nextLogoUrl: string | null) => ({
    role,
    name,
    shortName,
    city,
    department,
    country,
    description,
    website,
    email,
    phone,
    address,
    academicYear,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    surfaceColor,
    textColor,
    mutedTextColor,
    themeMode: themeMode as "light" | "dark",
    borderRadius,
    logoUrl: nextLogoUrl,
  });

  const save = () => {
    const cleanLogo = logoUrl && !logoUrl.startsWith("data:") ? logoUrl : (school.logoUrl ?? null);
    schoolMutation.mutate(schoolPayload(cleanLogo));
  };

  const removeLogo = () => {
    if (!window.confirm("¿Deseas quitar el escudo institucional?")) return;
    setLogoUrl(null);
    schoolMutation.mutate(schoolPayload(null));
  };

  const readLogo = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!LOGO_EXTENSIONS.includes(ext)) {
      toast.error("Formato no válido. Usa PNG, JPG, JPEG, SVG o WEBP.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("El escudo no puede superar los 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setLogoUrl(result);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        try {
          ctx.drawImage(image, 0, 0, 1, 1);
          const pixel = ctx.getImageData(0, 0, 1, 1).data;
          const hex = `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, "0")).join("")}`;
          setSuggestedPalette({ primary: hex, secondary: "#eaf4ff", accent: "#8ec6fa" });
        } catch {
          // Sin paleta sugerida si el navegador no permite leer la imagen.
        }
      };
      image.src = result;
      if (canEdit) {
        uploadMutation.mutate({
          role,
          fileName: file.name,
          contentType: file.type,
          dataBase64: result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const applySuggestedPalette = () => {
    if (!suggestedPalette) return;
    setPrimaryColor(suggestedPalette.primary);
    setSecondaryColor(suggestedPalette.secondary);
    setAccentColor(suggestedPalette.accent);
    setSuggestedPalette(null);
  };

  const periodRangeInvalid = Boolean(periodStart && periodEnd && periodEnd <= periodStart);
  const canCreatePeriod = canEdit && Boolean(periodName.trim() && periodStart && periodEnd) && !periodRangeInvalid && !periodMutation.isPending;
  const createPeriod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreatePeriod) return;
    periodMutation.mutate({
      role,
      name: periodName.trim(),
      startDate: new Date(periodStart),
      endDate: new Date(periodEnd),
      status: "Programado",
    });
  };

  const savedYear = school.academicYear ?? academicYear;
  const periods: any[] = data?.academicPeriods ?? [];
  const saving = schoolMutation.isPending;
  const uploading = uploadMutation.isPending;

  const colorFields: Array<[label: string, value: string, setter: (value: string) => void]> = [
    ["Color principal", primaryColor, setPrimaryColor],
    ["Color secundario", secondaryColor, setSecondaryColor],
    ["Color de acento", accentColor, setAccentColor],
    ["Fondo", backgroundColor, setBackgroundColor],
    ["Superficie", surfaceColor, setSurfaceColor],
    ["Texto", textColor, setTextColor],
    ["Texto secundario", mutedTextColor, setMutedTextColor],
  ];

  const saveButton = canEdit && tab !== "periods" ? (
    <button type="button" className="adm-btn adm-btn--primary" onClick={save} disabled={saving}>
      {saving ? <Loader2 aria-hidden="true" className="set-spin" strokeWidth={2} /> : <Check aria-hidden="true" strokeWidth={2} />}
      {saving ? "Guardando..." : "Guardar cambios"}
    </button>
  ) : null;

  return (
    <AdminPage label="Configuración">
      <AdminHeader
        chip={`Año lectivo ${savedYear}`}
        title="Configuración"
        lede="La identidad, la apariencia y el calendario académico de tu colegio, en un solo lugar."
        actions={saveButton}
      />

      <div className="adm-section">
        <div className="set-tabs">
          <Segment variant="tabs" label="Secciones de configuración" options={TABS} value={tab} onChange={setTab} />
        </div>

        {!canEdit ? (
          <p className="adm-note adm-note--warn" role="note">
            Estás viendo la configuración en modo lectura. Solo la administración institucional puede hacer cambios.
          </p>
        ) : null}

        {tab === "institution" ? (
          <div className="adm-columns" role="tabpanel" aria-label="Institución">
            <section className="adm-surface adm-panel" aria-labelledby="set-identity-title">
              <PanelHead id="set-identity-title" title="Identidad institucional" sub="Información visible para la comunidad educativa." />
              <div className="adm-form">
                <div className="adm-form__row">
                  <Field label="Nombre institucional">
                    <input className="adm-input" value={name} onChange={event => setName(event.target.value)} disabled={!canEdit} autoComplete="organization" />
                  </Field>
                  <Field label="Nombre corto">
                    <input className="adm-input" value={shortName} onChange={event => setShortName(event.target.value)} disabled={!canEdit} />
                  </Field>
                </div>
                <Field label="Descripción">
                  <textarea className="adm-textarea" value={description} onChange={event => setDescription(event.target.value)} disabled={!canEdit} />
                </Field>
                <div className="adm-form__row" style={THREE_COLUMNS}>
                  <Field label="Ciudad">
                    <input className="adm-input" value={city} onChange={event => setCity(event.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="Departamento">
                    <input className="adm-input" value={department} onChange={event => setDepartment(event.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="País">
                    <input className="adm-input" value={country} onChange={event => setCountry(event.target.value)} disabled={!canEdit} />
                  </Field>
                </div>
                <div className="adm-form__row">
                  <Field label="Sitio web">
                    <input className="adm-input" type="url" inputMode="url" value={website} onChange={event => setWebsite(event.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="Correo institucional">
                    <input className="adm-input" type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="Teléfono">
                    <input className="adm-input" type="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="Dirección">
                    <input className="adm-input" value={address} onChange={event => setAddress(event.target.value)} disabled={!canEdit} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="adm-surface adm-panel" aria-labelledby="set-logo-title">
              <PanelHead id="set-logo-title" title="Escudo institucional" sub="PNG, JPG, SVG o WEBP · máximo 5 MB." />
              <div className="set-logo">
                {uploading ? (
                  <div className="set-logo__overlay" role="status">
                    <Loader2 aria-hidden="true" className="set-spin" strokeWidth={2} />
                    <span>Subiendo escudo institucional...</span>
                  </div>
                ) : null}
                {logoUrl ? (
                  <img src={storageUrl(logoUrl) ?? logoUrl} alt="Escudo institucional" className="set-logo__img" />
                ) : (
                  <span className="set-logo__placeholder" role="img" aria-label="Sin escudo cargado">E</span>
                )}
              </div>

              {canEdit ? (
                <div className="set-logo__actions">
                  <label className={cn("adm-btn adm-btn--outline set-upload", uploading && "is-disabled")}>
                    <Upload aria-hidden="true" strokeWidth={1.9} />
                    {logoUrl ? "Cambiar escudo" : "Subir escudo"}
                    <input
                      type="file"
                      className="set-file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      disabled={uploading}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) readLogo(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {logoUrl ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn--danger set-logo__remove"
                      onClick={removeLogo}
                      disabled={uploading || saving}
                      aria-label="Quitar escudo"
                      title="Quitar escudo"
                    >
                      <Trash2 aria-hidden="true" strokeWidth={1.9} />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {suggestedPalette ? (
                <div className="set-palette" role="group" aria-labelledby="set-palette-title">
                  <div>
                    <p id="set-palette-title" className="set-palette__title">Paleta sugerida</p>
                    <p className="set-palette__text">Tomada del escudo. Se aplica a los colores principal, secundario y de acento.</p>
                  </div>
                  <div className="set-palette__swatches">
                    {([
                      ["Principal", suggestedPalette.primary],
                      ["Secundario", suggestedPalette.secondary],
                      ["Acento", suggestedPalette.accent],
                    ] as const).map(([label, color]) => (
                      <div key={label} className="set-swatch">
                        <span className="set-swatch__color" style={{ backgroundColor: color }} />
                        <span className="set-swatch__label">
                          {label} <span className="adm-num">{color.toUpperCase()}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="set-palette__actions">
                    <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={applySuggestedPalette}>
                      Aplicar
                    </button>
                    <button type="button" className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setSuggestedPalette(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : tab === "appearance" ? (
          <div className="adm-columns set-columns--preview" role="tabpanel" aria-label="Apariencia">
            <section className="adm-surface adm-panel" aria-labelledby="set-visual-title">
              <PanelHead id="set-visual-title" title="Identidad visual" sub="Cambia colores en vivo; guarda cuando estés conforme." />
              <div className="set-colors">
                {colorFields.map(([label, value, setter]) => {
                  const invalid = !HEX_COLOR.test(value);
                  return (
                    <div key={label} className="adm-field">
                      <span className="adm-label">{label}</span>
                      <div className="adm-color">
                        <input
                          type="color"
                          value={swatchValue(value)}
                          onChange={event => setter(event.target.value)}
                          disabled={!canEdit}
                          aria-label={`${label}: selector de color`}
                        />
                        <input
                          className={cn("adm-input set-hex", invalid && "is-invalid")}
                          value={value}
                          onChange={event => setter(event.target.value)}
                          disabled={!canEdit}
                          maxLength={7}
                          spellCheck={false}
                          aria-label={`${label}: código hexadecimal`}
                          aria-invalid={invalid}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="set-divider" aria-hidden="true" />
              <div className="adm-form__row">
                <Field label="Radio de bordes">
                  <OptionSelect className="adm-select" value={borderRadius} onValueChange={setBorderRadius} options={BORDER_RADIUS_OPTIONS} disabled={!canEdit} />
                </Field>
                <Field label="Tema">
                  <OptionSelect className="adm-select" value={themeMode} onValueChange={setThemeMode} options={THEME_MODE_OPTIONS} disabled={!canEdit} />
                </Field>
              </div>
            </section>

            <section className="adm-surface adm-panel set-sticky" aria-labelledby="set-preview-title">
              <PanelHead id="set-preview-title" title="Vista previa en vivo" sub="Navbar, sidebar, botón, tarjeta y estado." />
              <div className="set-preview-stage">
                <div className="set-preview" style={{ borderColor: secondaryColor, backgroundColor }} aria-hidden="true">
                  <div className="set-preview__bar" style={{ borderColor: secondaryColor, backgroundColor: surfaceColor }}>
                    <div className="set-preview__brand">
                      <span className="set-preview__logo" style={{ backgroundColor: secondaryColor, color: primaryColor }}>E</span>
                      <span style={{ color: textColor }}>{shortName}</span>
                    </div>
                    <span className="set-preview__app" style={{ color: mutedTextColor }}>EduCore</span>
                  </div>
                  <div className="set-preview__body">
                    <div className="set-preview__side" style={{ borderColor: secondaryColor }}>
                      <span className="set-preview__nav set-preview__nav--active" style={{ backgroundColor: secondaryColor, color: primaryColor, borderRadius }}>Inicio</span>
                      <span className="set-preview__nav" style={{ color: mutedTextColor }}>Académico</span>
                      <span className="set-preview__nav" style={{ color: mutedTextColor }}>Reportes</span>
                    </div>
                    <div className="set-preview__main">
                      <div>
                        <p className="set-preview__eyebrow" style={{ color: mutedTextColor }}>Vista institucional</p>
                        <p className="set-preview__heading" style={{ color: textColor }}>Todo bajo control.</p>
                      </div>
                      <div className="set-preview__card" style={{ borderColor: secondaryColor, backgroundColor: surfaceColor, borderRadius }}>
                        <p className="set-preview__eyebrow" style={{ color: mutedTextColor }}>Promedio institucional</p>
                        <p className="set-preview__value" style={{ color: textColor }}>4.1</p>
                        <span className="set-preview__badge" style={{ backgroundColor: accentColor, color: textColor }}>Listo</span>
                      </div>
                      <span className="set-preview__btn" style={{ backgroundColor: primaryColor, borderRadius }}>Guardar cambios</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="adm-columns" role="tabpanel" aria-label="Año y periodos">
            <section className="adm-surface adm-panel" aria-labelledby="set-periods-title">
              <PanelHead
                id="set-periods-title"
                title="Periodos del año"
                sub="Esta estructura quedará disponible para la lógica académica avanzada."
              >
                <span className="adm-count adm-num">{plural(periods.length, "periodo", "periodos")}</span>
              </PanelHead>

              <div className="set-year">
                <Field label="Año académico">
                  <input className="adm-input" value={academicYear} onChange={event => setAcademicYear(event.target.value)} disabled={!canEdit} inputMode="numeric" />
                </Field>
                {canEdit ? (
                  <button
                    type="button"
                    className="adm-btn adm-btn--outline"
                    onClick={save}
                    disabled={saving || academicYear === school.academicYear}
                  >
                    {saving ? <Loader2 aria-hidden="true" className="set-spin" strokeWidth={2} /> : <Check aria-hidden="true" strokeWidth={2} />}
                    {saving ? "Guardando..." : "Guardar año"}
                  </button>
                ) : null}
              </div>

              {periods.length === 0 ? (
                <EmptyState title="Aún no hay periodos" text="Crea el primer periodo del año lectivo con el formulario." />
              ) : (
                <ul className="adm-list set-periods">
                  {periods.map((period: any) => {
                    const tone = PERIOD_TONE[period.status] ?? "neutral";
                    const weeks = weeksBetween(period.startDate, period.endDate);
                    return (
                      <li key={period.id} className="adm-row">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "adm-avatar set-period-icon",
                            tone === "green" && "adm-avatar--green",
                            tone === "neutral" && "set-period-icon--muted",
                          )}
                        >
                          <CalendarRange strokeWidth={1.9} />
                        </span>
                        <div className="adm-row__body">
                          <div className="adm-row__title">
                            <span className="adm-row__name">{period.name}</span>
                          </div>
                          <div className="adm-row__meta">
                            <span>
                              {formatShortDate(period.startDate)} – {formatShortDate(period.endDate)}
                            </span>
                            {weeks ? (
                              <>
                                <span className="adm-sep" aria-hidden="true">·</span>
                                <span className="adm-num">{plural(weeks, "semana", "semanas")}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="adm-row__actions">
                          <Pill tone={tone} dot>{period.status}</Pill>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="adm-surface adm-panel" aria-labelledby="set-new-period-title">
              <PanelHead id="set-new-period-title" title="Crear periodo" sub="Se crea con estado Programado." />
              <form className="adm-form" onSubmit={createPeriod} noValidate>
                <Field label="Nombre">
                  <input
                    className="adm-input"
                    value={periodName}
                    onChange={event => setPeriodName(event.target.value)}
                    placeholder="Ej. Periodo 5"
                    maxLength={80}
                    disabled={!canEdit}
                  />
                </Field>
                <div className="adm-form__row">
                  <Field label="Inicio">
                    <input className="adm-input" type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} disabled={!canEdit} />
                  </Field>
                  <Field label="Fin">
                    <input
                      className="adm-input"
                      type="date"
                      value={periodEnd}
                      min={periodStart || undefined}
                      onChange={event => setPeriodEnd(event.target.value)}
                      disabled={!canEdit}
                      aria-invalid={periodRangeInvalid}
                    />
                  </Field>
                </div>
                {periodRangeInvalid ? (
                  <p className="adm-note adm-note--error" role="alert">La fecha final debe ser posterior a la fecha inicial.</p>
                ) : (
                  <p className="adm-note">
                    Los periodos nuevos se agregan al año lectivo activo{savedYear ? ` (${savedYear})` : ""}.
                  </p>
                )}
                <button type="submit" className="adm-btn adm-btn--primary set-block-btn" disabled={!canCreatePeriod}>
                  {periodMutation.isPending ? <Loader2 aria-hidden="true" className="set-spin" strokeWidth={2} /> : <Plus aria-hidden="true" strokeWidth={2} />}
                  {periodMutation.isPending ? "Creando..." : "Crear periodo"}
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
