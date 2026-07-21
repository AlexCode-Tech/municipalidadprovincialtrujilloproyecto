# Sistema de Licencias de Funcionamiento — Municipalidad Provincial de Trujillo

Aplicación full-stack Next.js para solicitudes presenciales y digitales, pagos, inspecciones, emisión de PDF y renovación de licencias municipales. Solo contempla los roles **Negocio**, **Cajero** e **Inspector** y los 12 distritos definidos para el proyecto.

## Inicio rápido

```bash
npm install
copy .env.example .env.local
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abre `http://localhost:3000`. Para recorrer la interfaz sin crear usuarios:

- Negocio: `negocio@demo.pe` / `demo123`
- Cajero: `cajero@demo.pe` / `demo123`
- Inspector: `inspector@demo.pe` / `demo123`

## Configuración

Completa `.env.local` con PostgreSQL/Neon, Mercado Pago, Vercel Blob, Upstash Redis/QStash, SMTP y VAPID. Las variables públicas deben usar el prefijo `NEXT_PUBLIC_`; en particular, la clave de frontend de Mercado Pago es `NEXT_PUBLIC_MP_PUBLIC_KEY`.

El cron de Vercel se ejecuta a las 13:00 UTC (08:00 en Perú) y revisa inspecciones del día, licencias vencidas y checkpoints de renovación próximos. Los endpoints internos de QStash validan la firma del mensaje.

## Flujo principal

1. El negocio o cajero registra RUC, razón social, domicilio, uno de los 12 distritos y plano.
2. Se procesa el pago fijo de S/180 por tarjeta o Yape.
3. Al aprobarse, se asigna la fecha más próxima disponible al único inspector.
4. Una primera observación programa otra visita a 30 días hábiles; una segunda observación deniega el trámite.
5. La conformidad genera una licencia vigente por un año y descargable en PDF.
6. Antes de renovar, el negocio debe confirmar que no hubo cambios. Solo entonces QStash puede cobrar la tarjeta guardada; Yape requiere pago manual.
7. Al vencer, se notifica por correo y push, y el PDF incorpora la marca de agua `VENCIDA`.

## Despliegue en Vercel

Conecta el repositorio, configura las variables de entorno y crea un Blob Store. Para producción usa una `DATABASE_URL` de Neon con SSL y registra la URL pública del webhook de Mercado Pago en `MP_WEBHOOK_URL`.
