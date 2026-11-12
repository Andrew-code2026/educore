import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** Hay credenciales de Anthropic en el entorno. No comprueba que sean válidas. */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());
}

/** Cliente de la API de Claude. Lee las credenciales del entorno (ANTHROPIC_API_KEY). */
export function getAnthropic(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** Mensaje para el docente a partir de un error de la API, sin detalles técnicos ni secretos. */
export function describeAnthropicError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "La clave de la API de Anthropic no es válida o no tiene permisos. Revisa ANTHROPIC_API_KEY en la configuración del servidor.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Se alcanzó el límite de uso de la IA por ahora. Inténtalo de nuevo en un minuto.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return "El modelo de IA configurado no existe. Revisa CREATOR_MODEL en la configuración del servidor.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return "La IA rechazó la solicitud. Intenta con una instrucción más corta o un recurso más pequeño.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "No pudimos conectar con el servicio de IA. Revisa la conexión del servidor e inténtalo de nuevo.";
  }
  if (error instanceof Anthropic.APIError) {
    return "El servicio de IA no está disponible en este momento. Inténtalo de nuevo en unos minutos.";
  }
  return "No pudimos completar la solicitud a la IA. Inténtalo de nuevo.";
}
