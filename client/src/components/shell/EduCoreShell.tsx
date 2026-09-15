import React from "react";
import type { EduCoreShellProps } from "./shell.types";
import { ShellContextProvider, useShellContext } from "./ShellContext";
import { EduCoreSidebar } from "./EduCoreSidebar";
import { EduCoreHeader } from "./EduCoreHeader";
import { EduCoreMobileNav } from "./EduCoreMobileNav";

function ShellInner({
  children,
  role,
  section,
  setSection,
  schoolName,
  school,
  onRoleChange,
  onLogout,
  notificationCount = 0,
}: EduCoreShellProps) {
  const { sidebarCollapsed } = useShellContext();

  return (
    <div
      className="min-h-screen page-shell text-slate-900 selection:bg-blue-100"
      style={
        {
          "--edc-primary": school?.primaryColor ?? "#2475cf",
          "--edc-secondary": school?.secondaryColor ?? "#eaf4ff",
          "--edc-accent": school?.accentColor ?? "#8ec6fa",
          "--edc-background": school?.backgroundColor ?? "#f7f9fc",
          "--edc-surface": school?.surfaceColor ?? "#ffffff",
          "--edc-text": school?.textColor ?? "#182131",
          "--edc-muted": school?.mutedTextColor ?? "#7a8798",
          "--edc-radius": school?.borderRadius ?? "12px",
        } as React.CSSProperties
      }
    >
      {/* 1. Sidebar de escritorio colapsable */}
      <EduCoreSidebar
        role={role}
        section={section}
        setSection={setSection}
        school={school}
        schoolName={schoolName}
        onLogout={onLogout}
        notificationCount={notificationCount}
      />

      {/* 2. Contenedor principal desplazable que se adapta al ancho de la barra lateral */}
      <div
        className={`flex min-h-screen flex-col transition-all duration-200 ease-out ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[250px]"
        }`}
      >
        {/* Header contextual */}
        <EduCoreHeader
          role={role}
          section={section}
          setSection={setSection}
          onRoleChange={onRoleChange}
          notificationCount={notificationCount}
        />

        {/* Contenido principal de la página */}
        <main className="page-transition flex-1 mx-auto w-full max-w-[1440px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
          {children}
        </main>

        {/* Navegación móvil inferior inteligente + Drawer */}
        <EduCoreMobileNav
          role={role}
          section={section}
          setSection={setSection}
          school={school}
          schoolName={schoolName}
          onRoleChange={onRoleChange}
          onLogout={onLogout}
          notificationCount={notificationCount}
        />
      </div>
    </div>
  );
}

export function EduCoreShell(props: EduCoreShellProps) {
  return (
    <ShellContextProvider
      section={props.section}
      role={props.role}
      schoolName={props.schoolName}
    >
      <ShellInner {...props} />
    </ShellContextProvider>
  );
}

export default EduCoreShell;
