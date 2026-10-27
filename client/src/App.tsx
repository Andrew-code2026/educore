import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { SECTION_ROUTE_PATTERN } from "./components/shell/routes";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return <Switch>
    {/* Un único Route para todas las secciones del shell (/, /grades, /attendance, ...).
        Las rutas se definen en components/shell/routes.ts (SECTION_PATHS). */}
    <Route path={SECTION_ROUTE_PATTERN} component={Home} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="light" switchable>
      <TooltipProvider delayDuration={200}>
        <Toaster position="bottom-right" />
        <Router />
      </TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}
