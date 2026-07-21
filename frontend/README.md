# 🌐 FRONTEND - Módulo de Interfaz de Usuario & Componentes

Esta carpeta contiene la capa de presentación y componentes de usuario del **Sistema de Licencias de Funcionamiento de Trujillo**:

## 📁 Estructura del Frontend

- **`app/`**: Rutas y páginas de navegación
  - **`(auth)/login/`**: Formulario de inicio de sesión por roles (`NEGOCIO`, `CAJERO`, `INSPECTOR`).
  - **`negocio/`**: Portal del Contribuyente
    - `registro/`: Formulario interactivo con validación de RUC y plano.
    - `pago/`: Pasarela de pago MercadoPago y simulador.
    - `estado/`: Rastreo del estado del trámite en tiempo real.
    - `licencia/`: Descarga de Licencia PDF oficial con marca de agua.
  - **`cajero/`**: Portal del Cajero Municipal
    - `nuevo-tramite/`: Registro presencial de trámites.
    - `solicitudes/`: Tabla sincronizada en tiempo real de trámites pagados.
  - **`inspector/`**: Portal del Inspector
    - `inspecciones-hoy/`: Agenda de inspecciones y dictamen técnico.

- **`components/`**: Componentes visuales reutilizables
  - **`brand/`**: Logos e imagotipos institucionales de la MPT.
  - **`layout/`**: DashboardShell, cabeceras y estructuras.
  - **`tramites/`**: Formulario interactivo con validación de planos.
  - **`ui/`**: Badges de estado, botones e insumos UI.
