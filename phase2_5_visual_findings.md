# Fase 2.5 — Hallazgos visuales

La captura desktop muestra el nuevo shell con sidebar más delgado, navbar flotante con blur selectivo, fondo institucional suave, jerarquía tipográfica clara y cards con profundidad contenida. El dashboard conserva el orden de lectura: encabezado, acción principal, métricas, alertas, EduCore AI y actividad reciente.

La captura mobile a 375×812 muestra el header compacto con menú y notificaciones, cards apiladas, CTA táctil de ancho completo y navegación inferior fija con cuatro accesos principales. La navegación no requiere reducir el sidebar desktop y mantiene una interacción de aplicación móvil.

La captura full-page confirma que EduCore AI continúa destacado como capacidad institucional y que comunicaciones y actividad permanecen accesibles debajo del bloque de atención.

## Validación live adicional

El login conserva el flujo demo y ahora muestra el escudo institucional almacenado en `/manus-storage/`. El acceso admin abre correctamente el dashboard sin errores; el sidebar muestra el escudo, la navbar flotante, la acción principal, métricas, alertas, EduCore AI, comunicaciones y actividad reciente. Las funcionalidades existentes y la identidad institucional siguen visibles.

## Corrección de asset

Se detectó y corrigió una ruta de logo con espacios/paréntesis. El helper `storageUrl` ahora codifica cada segmento del path de storage, y el escudo vuelve a cargar correctamente en login, sidebar y configuración. El recurso sigue viniendo de storage; no se movieron bytes a la base de datos.
