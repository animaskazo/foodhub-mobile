# Push de pedidos nuevos — piloto

Rama `codex/new-order-push-pilot`. Requiere el backend de la misma rama en
`animaskazo/foodHub-POS`; allí están la migración, Edge Function, scheduler y
el procedimiento completo en `docs/push-pilot.md`. No se ha desplegado a Supabase.

La bandera `EXPO_PUBLIC_PUSH_PILOT` es false por defecto. Al habilitarla aparece
un control para activar/desactivar avisos. Solo usuarios inscritos por servidor
pueden registrar el teléfono. El token va por RPC autenticado, el servidor
elige el negocio y valida proyecto Expo y sesión; nunca se guarda service_role
en el móvil. La instalación usa un UUID aleatorio, no un identificador físico.
Se renueva al primer plano, cada hora y al rotar el token, sin volver a pedir
permisos. Revocar permisos borra el registro al regresar a la app. Cerrar sesión
revoca el registro antes de desconectarse; si falla, muestra el error.

Tocar un aviso en caliente/frío lleva al tab Pedidos y abre el detalle por ID.
Sin sesión se conserva la intención durante el login. Se comprueba el negocio
antes de navegar y el servidor vuelve a autorizar la lectura. Un ID malformado,
otro tipo de aviso o un pedido de otro negocio no se abre. No requiere que el
pedido esté entre los últimos 150. No cambia las alertas existentes del POS.

## Preparación

Copiar `.env.example`; usar URL y clave pública del proyecto Supabase de prueba
confirmado, `EXPO_PUBLIC_PUSH_PILOT=true` y el UUID REAL del proyecto EAS en
`EXPO_PUBLIC_EAS_PROJECT_ID`. El repo aún no contiene un proyecto EAS ni bundle
identifier oficial: obtenerlos de la cuenta que firma la aplicación, no inventarlos.
Se pueden suministrar `FOODHUB_IOS_BUNDLE_IDENTIFIER` y `FOODHUB_ANDROID_PACKAGE`
al resolver `app.config.js`. El mismo EAS UUID debe figurar en la inscripción
del negocio en el backend. No incluir claves APNs, access token Expo ni secretos
del worker en variables EXPO_PUBLIC.

Se añadió `expo-notifications` y `expo-crypto` compatibles con SDK 58 y el plugin
de notificaciones. Requiere una compilación nativa nueva; no basta recargar JS.
El proyecto usa React Native `0.88.0-rc.3`; npm ci tiene un conflicto preexistente
de peer dependencies. En esta revisión se instaló con
`npm ci --ignore-scripts --legacy-peer-deps --omit=optional`; no se cambió React Native.

## Credenciales y coste de Apple

Expo Push -> APNs necesita una app firmada con Push Notifications habilitado y
credenciales APNs válidas de una cuenta pagada Apple Developer para probar en
iPhone físico. Expo/Supabase no eliminan ese requisito. Configurar en la cuenta
EAS correspondiente la clave APNs `.p8`, Key ID y Team ID (o el mecanismo de
credenciales gestionadas de EAS), y un provisioning profile que incluya push y
coincida con el bundle identifier. Para una build local, configurar credenciales
con `eas credentials` igualmente. La clave privada no debe subirse a GitHub.
Consultar los requisitos oficiales antes de generar/facturar credenciales:
https://docs.expo.dev/push-notifications/push-notifications-setup/

Sin Apple de pago se pueden ejecutar estas pruebas locales y las del backend;
no demuestran recepción APNs en un iPhone físico. Android puede servir para una
prueba remota independiente de Apple, pero necesita credenciales FCM v1 propias.

## Verificaciones

`npm run lint`, `npm run typecheck:push`, `npm run test:push`,
`npx expo config --type public`. El typecheck usa `checkJs` sobre los módulos
nuevos; no convierte toda la aplicación existente a TypeScript.
Las pruebas de permisos/tokens usan dobles de Expo/Supabase, sin envío real.
Quedan pendientes la firma/build, recepción con app abierta/cerrada, toque con
login pendiente, bloqueo entre negocios y revocación en un dispositivo real.
