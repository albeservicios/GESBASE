#!/bin/bash
# ============================================================
# GESBASE - Acceso para un segundo usuario del VPS
# Le da acceso SOLO al proyecto (código, logs, restart).
# NO ve: el resto del home ni los secretos (.env, serviceAccountKey)
# Uso: bash $HOME/gesbase-app/server/deploy/setup-partner.sh <usuario>
# ============================================================

set -e

if [ "$(uname -s)" != "Linux" ]; then
    echo "ERROR: solo en el VPS."
    exit 1
fi

P="$1"
if [ -z "$P" ]; then
    echo "Uso: $0 <usuario-del-vps>"
    exit 1
fi
if ! id "$P" >/dev/null 2>&1; then
    echo "ERROR: el usuario '$P' no existe en este VPS."
    echo "Creá el usuario primero en el panel de DreamHost (Users -> Add User)."
    exit 1
fi
if ! command -v setfacl >/dev/null; then
    echo "ERROR: setfacl no disponible en este sistema."
    exit 1
fi

# Puede atravesar el home (ejecutar) pero NO listarlo
setfacl -m "u:$P:--x" "$HOME"

# Proyecto: lectura/escritura completa + heredado en archivos nuevos
setfacl -R  -m "u:$P:rwx" $HOME/gesbase-app
setfacl -R -d -m "u:$P:rwx" $HOME/gesbase-app

# Logs: lectura/escritura
setfacl -R  -m "u:$P:rwX" ~/gesbase-logs
setfacl -R -d -m "u:$P:rwX" ~/gesbase-logs

# Datos de Mongo: solo lectura (no puede borrar la DB)
setfacl -R -m "u:$P:r-X" ~/mongodb-data

# Binarios (node, mongod, cloudflared) y scripts: leer + ejecutar
setfacl -R -m "u:$P:r-X" ~/opt
setfacl    -m "u:$P:r-X" ~/bin
setfacl    -m "u:$P:r-X" ~/bin/gesbase-start.sh ~/bin/gesbase-stop.sh 2>/dev/null || true

# Secretos: negar explícitamente
for f in $HOME/gesbase-app/server/.env $HOME/gesbase-app/server/.jwt-secret \
         $HOME/gesbase-app/server/serviceAccountKey.json; do
    if [ -f "$f" ]; then
        chmod 600 "$f"
        setfacl -m "u:$P:---" "$f"
    fi
done

echo ""
echo "OK: '$P' ahora tiene acceso al proyecto GESBASE."
echo "  - código:      $HOME/gesbase-app  (leer/editar)"
echo "  - logs:        ~/gesbase-logs"
echo "  - reiniciar:   touch $HOME/gesbase-app/.restart-requested"
echo "    (el watchdog reinicia todo en < 5 min, como usuario gesbase)"
echo "  - NO accede a: resto del home, .env, .jwt-secret, serviceAccountKey"
echo "  - DB: sin la contraseña de mongo no puede escribirla"
echo "    (MONGO_PASS está en server/.env - compartila solo si querés)"
