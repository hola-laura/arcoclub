# Web de arco

Web pública y panel de contenido para arco, agencia inmobiliaria de Madrid. Proyecto de amable.

- `index.html`: la web (portada, viviendas, ficha con mapa, barrios, vender, sobre arco, contacto, privacidad), en español e inglés.
- `admin.html`: el panel. Desde ahí se cambian viviendas, fotos, barrios y todos los textos.
- `content/contenido.js`: contenido inicial. Lo que se guarda desde el panel lo sustituye.
- `config.js`: dirección del almacén de Google. Vacía = modo de prueba.
- `google/Code.gs`: el almacén (Google Apps Script): contenido en Drive, fotos y mensajes de los formularios.

## Modo de prueba
Con `API_URL` vacía, el panel se abre sin contraseña y guarda solo en el navegador. La web, abierta en ese mismo navegador, enseña esos cambios. Los formularios no envían nada.

## Conectar el panel
1. En Drive, crear una carpeta para arco y copiar su id (lo que va después de `/folders/` en la dirección).
2. En script.google.com, crear un proyecto, pegar `google/Code.gs` y, en Configuración del proyecto > Propiedades de la secuencia de comandos, añadir `CARPETA_ID`, `PANEL_CLAVE` (la contraseña del panel) y `AVISO_EMAIL` (quien recibe los mensajes).
3. Implementar > Nueva implementación > Aplicación web. Ejecutar como: yo. Acceso: cualquier usuario.
4. Pegar la dirección que termina en `/exec` en `config.js`.

Si se cambia `Code.gs`, hay que publicar una versión nueva desde «Implementar».
