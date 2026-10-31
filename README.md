# FoodHub Mobile (Expo)

App móvil para ver el **dashboard y las ventas** del local. Usa el mismo backend
Supabase que `foodhub-pos`, en carpeta separada.

## Configurar

1. Copiar credenciales (las mismas del proyecto web):

```bash
cp .env.example .env
```

2. Editar `.env` con los valores de `../foodhub-pos/.env.local`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Correr

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go** (Android/iOS) o presiona `w` para web.

## Qué incluye

- **Login** con email + contraseña (respeta cuentas desactivadas y PIN por cambiar,
  igual que la web).
- **Dashboard**: ventas de hoy (monto, nº pedidos, ticket promedio) + últimos 8
  pedidos del día.
- **Ventas**: lista de pedidos (filtro Hoy/Todas) con total, expandible por pedido
  para ver ítems y descuento. Pull-to-refresh en ambas pantallas.
- **Vender** (básico): productos disponibles + buscador, carrito con cantidades,
  método Efectivo/Tarjeta y cobro. Registra orden pagada con sus ítems y muestra
  confirmación con nº de pedido. Sin variantes, combos, cupones, mesas ni
  impresión (pendiente).

## Diseño

Claro, primario negro y botones pill, igual que el sistema de diseño web.
