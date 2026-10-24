import React from "react";
import type { EduCoreShellProps, Section } from "./shell.types";
import { ShellContextProvider, useShellContext } from "./ShellContext";
import { EduCoreSidebar } from "./EduCoreSidebar";
import { EduCoreHeader } from "./EduCoreHeader";
import { EduCoreMobileNav } from "./EduCoreMobileNav";
import "./shell.css";

function ShellInner({
  children,
  role,
  section,
  setSection,
  schoolName,
  school,
  user,
  onRoleChange,
  onLogout,
  notificationCount = 0,
}: EduCoreShellProps) {
  const { sidebarCollapsed, navGuard, isFocusMode } = useShellContext();

  const handleSetSection = React.useCallback(
    (nextSection: Section) => {
      if (nextSection === section) return;
      if (navGuard) {
        navGuard(() => setSection(nextSection), nextSection);
      } else {
        setSection(nextSection);
      }
    },
    [navGuard, section, setSection]
  );

  const handleLogout = React.useCallback(() => {
    if (navGuard) {
      navGuard(() => onLogout?.());
    } else {
      onLogout?.();
    }
  }, [navGuard, onLogout]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    const mainContent = document.getElementById("educore-main-content");
    if (mainContent) mainContent.scrollTop = 0;
  }, [section]);

  const isFullBleed =
    section === "grades" || section === "attendance" || section === "classroom" || section === "analytics";

  return (
    <div
      className="edc-shell selection:bg-blue-100"
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
      {/* Marco: riel lateral a la izquierda, topbar y panel principal a la derecha */}
      <div className="edc-frame" data-collapsed={sidebarCollapsed} data-focus={isFocusMode}>
        <EduCoreHeader
          role={role}
          section={section}
          setSection={handleSetSection}
          onRoleChange={onRoleChange}
          notificationCount={notificationCount}
          user={user}
        />

        <EduCoreSidebar
          role={role}
          section={section}
          setSection={handleSetSection}
          school={school}
          schoolName={schoolName}
          onLogout={handleLogout}
          notificationCount={notificationCount}
          user={user}
        />

        {isFullBleed ? (
          <main className="edc-main edc-main--bleed">{children}</main>
        ) : (
          <main id="educore-main-content" className="edc-main">
            <div aria-hidden="true" className="edc-main__glow edc-main__glow--a" />
            <div aria-hidden="true" className="edc-main__glow edc-main__glow--b" />
            <div className="edc-main__content page-transition">{children}</div>
          </main>
        )}
      </div>

      {/* Navegación móvil inferior inteligente + Drawer */}
      <EduCoreMobileNav
        role={role}
        section={section}
        setSection={handleSetSection}
        school={school}
        schoolName={schoolName}
        onRoleChange={onRoleChange}
        onLogout={handleLogout}
        notificationCount={notificationCount}
      />
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
