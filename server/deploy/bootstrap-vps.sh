#!/bin/bash
# ============================================================
# GESBASE - Bootstrap VPS (sin sudo, todo en $HOME)
# Uso:  bash ~/gesbase/server/deploy/bootstrap-vps.sh
# Requiere que el código ya esté en ~/gesbase (vía rsync).
# ============================================================

set -e

if [ "$(uname -s)" != "Linux" ]; then
    echo "ERROR: este script es para el VPS (Linux)."
    echo "Estás en $(uname -s). Ejecutalo en la terminal del VPS"
    echo "(la que muestra el prompt [vps46874]$)."
    exit 1
fi

cd "$HOME"

echo "==> GESBASE bootstrap iniciando..."

# ---------- Arquitectura ----------
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)          NARCH=x64;   MARCH=x86_64  ;;
    aarch64|arm64)   NARCH=arm64; MARCH=aarch64 ;;
    *) echo "Arquitectura no soportada: $ARCH"; exit 1 ;;
esac
echo "==> Arch: $ARCH"

# ~/logs es de DreamHost (dhapache, solo lectura) — usamos gesbase-logs
mkdir -p ~/opt ~/gesbase-logs ~/mongodb-data ~/bin

# ---------- Node.js 20 ----------
if [ ! -x "$HOME/opt/node/bin/node" ]; then
    echo "==> Instalando Node.js 20..."
    curl -fsSL "https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-$NARCH.tar.xz" -o /tmp/node.tar.xz
    tar -xJf /tmp/node.tar.xz -C /tmp
    rm -rf ~/opt/node
    mv "/tmp/node-v20.18.0-linux-$NARCH" ~/opt/node
fi
export PATH="$HOME/opt/node/bin:$HOME/opt/mongodb/bin:$PATH"
grep -q 'opt/node/bin' ~/.bashrc 2>/dev/null || \
    echo 'export PATH="$HOME/opt/node/bin:$HOME/opt/mongodb/bin:$PATH"' >> ~/.bashrc
echo "    node $(~/opt/node/bin/node --version)"

# ---------- MongoDB ----------
if [ ! -x "$HOME/opt/mongodb/bin/mongod" ]; then
    echo "==> Instalando MongoDB 8..."
    # Detectar Ubuntu para el binario correcto
    UB=ubuntu2204
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "${VERSION_ID%%.*}" in
            24) UB=ubuntu2404 ;;
            22) UB=ubuntu2204 ;;
            20) UB=ubuntu2004 ;;
            *)  UB=ubuntu2204 ;;  # Debian y otros: 2204 funciona
        esac
    fi
    curl -fsSL "https://fastdl.mongodb.org/linux/mongodb-linux-$MARCH-$UB-8.0.0.tgz" -o /tmp/mongodb.tgz
    rm -rf /tmp/mongox && mkdir -p /tmp/mongox
    tar -xzf /tmp/mongodb.tgz -C /tmp/mongox
    mkdir -p ~/opt/mongodb/bin
    cp /tmp/mongox/mongodb-linux-*/bin/mongod ~/opt/mongodb/bin/
fi
echo "    mongod instalado"

# ---------- .env ----------
if [ ! -f ~/gesbase/server/.env ]; then
    cat > ~/gesbase/server/.env <<'ENVEOF'
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=gesbase
JWT_SECRET=
JWT_TTL=30d
PUBLIC_URL=https://gesbase.online
RESEND_API_KEY=
RESEND_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
ENVEOF
    echo "==> .env creado (PUBLIC_URL=https://gesbase.online)"
fi

# ---------- dependencias ----------
echo "==> npm install..."
cd ~/gesbase/server
~/opt/node/bin/npm install --omit=dev --no-audit --no-fund

# ---------- scripts de arranque ----------
cat > ~/bin/gesbase-start.sh <<'STARTEOF'
#!/bin/bash
export PATH="$HOME/opt/node/bin:$HOME/opt/mongodb/bin:$PATH"

# MongoDB
if ! pgrep -f "mongod.*mongodb-data" >/dev/null; then
    ~/opt/mongodb/bin/mongod --dbpath ~/mongodb-data \
        --bind_ip 127.0.0.1 --port 27017 \
        --fork --logpath ~/gesbase-logs/mongod.log
fi

# App Node
if ! pgrep -f "node src/index.js" >/dev/null; then
    cd ~/gesbase/server
    nohup node src/index.js >> ~/gesbase-logs/app.log 2>&1 &
fi
STARTEOF
chmod +x ~/bin/gesbase-start.sh

cat > ~/bin/gesbase-stop.sh <<'STOPEOF'
#!/bin/bash
pkill -f "node src/index.js" 2>/dev/null
pkill -f "mongod.*mongodb-data" 2>/dev/null
STOPEOF
chmod +x ~/bin/gesbase-stop.sh

# ---------- cron: arranque en reboot + watchdog ----------
(crontab -l 2>/dev/null | grep -v gesbase-start; \
 echo "@reboot $HOME/bin/gesbase-start.sh"; \
 echo "*/5 * * * * $HOME/bin/gesbase-start.sh") | crontab -
echo "==> cron configurado (reboot + chequeo cada 5 min)"

# ---------- iniciar ----------
~/bin/gesbase-start.sh
sleep 3

# ---------- importar datos ----------
if [ -d ~/gesbase/server/data/export ] && \
   ls ~/gesbase/server/data/export/*.json >/dev/null 2>&1; then
    echo "==> Importando datos a MongoDB..."
    cd ~/gesbase/server && ~/opt/node/bin/npm run import:mongo
else
    echo "==> Sin datos para importar (server/data/export vacío)"
fi

# ---------- estado ----------
echo ""
echo "============================================"
echo "  GESBASE desplegado"
echo "============================================"
curl -s -o /dev/null -w "App en :3001 -> HTTP %{http_code}\n" \
    http://localhost:3001/index.html || true
echo "Logs:  ~/gesbase-logs/app.log  y  ~/gesbase-logs/mongod.log"
echo "Start: ~/bin/gesbase-start.sh | Stop: ~/bin/gesbase-stop.sh"
