// Almacén de la web de arco en Google Drive: contenido, fotos y mensajes.
// Puesta en marcha: ver LEEME.md, apartado «Conectar el panel».
//
// Propiedades del script (Configuración del proyecto > Propiedades de la secuencia de comandos):
//   CARPETA_ID   Id de la carpeta de Drive donde se guarda todo.
//   PANEL_CLAVE  Contraseña del panel. Sin ella no se puede guardar nada.
//   AVISO_EMAIL  Correo que recibe los mensajes de la web (si falta, el del dueño del script).

const NOMBRE = 'contenido-web.json';
const SECCIONES = ['general', 'portada', 'propiedades', 'barrios', 'vender', 'sobre', 'legal'];
const MAX_BYTES = 2000000;
const MAX_FOTO = 8000000; // en base64
const HOJA = 'Mensajes de la web';
const MAX_POR_HORA = 30;

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function carpeta_() { return DriveApp.getFolderById(prop_('CARPETA_ID')); }
function archivo_() {
  const lista = carpeta_().getFilesByName(NOMBRE);
  return lista.hasNext() ? lista.next() : carpeta_().createFile(NOMBRE, '{}', 'application/json');
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function claveBuena_(p) {
  const c = prop_('PANEL_CLAVE');
  if (!c) return 'sinclave';
  return String(p.clave || '') === c ? '' : 'clave';
}

function doGet() {
  return ContentService.createTextOutput(archivo_().getBlob().getDataAsString('UTF-8')).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'peticion' }); }
  if (p.accion === 'contacto') return contacto_(p);

  // Todo lo demás es del panel y pide contraseña.
  const fallo = claveBuena_(p);
  if (fallo) { Utilities.sleep(800); return json_({ ok: false, error: fallo }); }
  if (p.accion === 'comprobar') return json_({ ok: true });
  if (p.accion === 'subir') return subir_(p);
  if (p.accion !== 'guardar' || SECCIONES.indexOf(p.clave_seccion) < 0) return json_({ ok: false, error: 'peticion' });

  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(15000);
  try {
    const f = archivo_();
    const datos = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}');
    datos[p.clave_seccion] = p.datos;
    const texto = JSON.stringify(datos);
    if (texto.length > MAX_BYTES) return json_({ ok: false, error: 'tamano' });
    f.setContent(texto);
    return json_({ ok: true });
  } finally {
    cerrojo.releaseLock();
  }
}

// Guarda una foto en la subcarpeta «fotos» y devuelve su dirección pública.
function subir_(p) {
  const b64 = String(p.datos || '');
  if (!b64 || b64.length > MAX_FOTO) return json_({ ok: false, error: 'tamano' });
  const nombre = String(p.nombre || 'foto.jpg').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'foto.jpg';
  const raiz = carpeta_();
  const sub = raiz.getFoldersByName('fotos');
  const fotos = sub.hasNext() ? sub.next() : raiz.createFolder('fotos');
  const f = fotos.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', nombre));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return json_({ ok: true, url: 'https://lh3.googleusercontent.com/d/' + f.getId() + '=w2000' });
}

// Los mensajes de la web van a una hoja de cálculo y avisan por correo.
function hoja_() {
  const lista = carpeta_().getFilesByName(HOJA);
  if (lista.hasNext()) return SpreadsheetApp.open(lista.next()).getSheets()[0];
  const libro = SpreadsheetApp.create(HOJA);
  DriveApp.getFileById(libro.getId()).moveTo(carpeta_());
  const h = libro.getSheets()[0];
  h.appendRow(['Fecha', 'Tipo', 'Nombre', 'Correo', 'Teléfono', 'Vivienda o dirección', 'Mensaje', 'Idioma', 'Estado']);
  h.getRange(1, 1, 1, 9).setFontWeight('bold');
  h.setFrozenRows(1);
  h.setColumnWidth(7, 420);
  return h;
}
function texto_(v, max) {
  const t = String(v || '').trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t; // Evita que la hoja lo trate como fórmula.
}
function contacto_(p) {
  if (p.web) return json_({ ok: true }); // Campo trampa: solo lo rellenan los robots.
  const nombre = texto_(p.nombre, 120), correo = String(p.correo || '').trim().slice(0, 160);
  const telefono = texto_(p.telefono, 40), mensaje = texto_(p.mensaje, 3000);
  const tipos = { visita: 'Visita', valoracion: 'Valoración', contacto: 'Contacto' };
  const tipo = tipos[p.tipo] || 'Contacto';
  const sobre = texto_(p.vivienda || [p.direccion, p.m2 ? p.m2 + ' m²' : ''].filter(String).join(', '), 300);
  if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !p.acepta) return json_({ ok: false, error: 'datos' });
  const cache = CacheService.getScriptCache(), n = Number(cache.get('contactos') || 0);
  if (n >= MAX_POR_HORA) return json_({ ok: false, error: 'limite' });
  cache.put('contactos', String(n + 1), 3600);
  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(15000);
  try {
    hoja_().appendRow([new Date(), tipo, nombre, correo, telefono, sobre, mensaje, p.idioma === 'en' ? 'Inglés' : 'Español', 'Nuevo']);
  } finally {
    cerrojo.releaseLock();
  }
  const para = prop_('AVISO_EMAIL') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: para, replyTo: correo,
    subject: 'arco · ' + tipo + ': ' + nombre + (sobre ? ' (' + sobre + ')' : ''),
    body: 'Tipo: ' + tipo + '\nNombre: ' + nombre + '\nCorreo: ' + correo + '\nTeléfono: ' + telefono + (sobre ? '\nVivienda o dirección: ' + sobre : '') + '\n\nMensaje:\n' + mensaje + '\n\nResponde a este correo para contestarle directamente.'
  });
  return json_({ ok: true });
}
