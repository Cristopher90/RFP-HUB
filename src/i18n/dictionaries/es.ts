// Canonical dictionary — its shape is the `Dictionary` type every other
// locale must match. Keys are namespaced by feature/screen, not by literal
// text, so editing Spanish copy later never silently orphans a translation.
export const es = {
  common: {
    save: "Guardar",
    saving: "Guardando...",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    loading: "Cargando...",
    search: "Buscar",
  },
  nav: {
    myProfile: "Mi perfil",
    logout: "Salir",
    newRfp: "Nueva RFP",
    rfps: "RFPs",
    settings: "Configuración",
    systemTables: "Tablas del sistema",
  },
  footer: {
    tagline: "RFP.HUB · herramienta de compras y sourcing · datos de demostración",
    sessionStarted: "Sesión iniciada",
  },
  login: {
    title: "RFP.HUB",
    subtitle: "Inicia sesión para continuar",
    client: "Cliente",
    supplier: "Proveedor",
    email: "Correo",
    password: "Contraseña",
    signIn: "Iniciar sesión",
    signInAsSupplier: "Iniciar sesión como proveedor",
    demoHint: "o entra como usuario demo",
    access: "Acceder",
  },
  profile: {
    title: "Mi perfil",
    subtitle: "Preferencias de idioma, zona horaria y moneda para tu cuenta.",
    language: "Idioma",
    timezone: "Zona horaria",
    currency: "Moneda",
    save: "Guardar cambios",
    saved: "Preferencias guardadas.",
  },
};

export type Dictionary = typeof es;
