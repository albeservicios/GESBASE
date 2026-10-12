# GESBASE - Deploy a DreamHost VPS

Guía de salida a producción. Requisitos: VPS con acceso root/sudo
(en shared hosting NO se puede correr Node persistente ni MongoDB;
si tenés shared, hay que usar MongoDB Atlas gratis + Passenger/Node).

## Arquitectura en producción

```
Internet -> Cloudflare (DNS + TLS gratis, proxy naranja)
         -> VPS nginx :80  ->  localhost:3001 (Node/Express)
                                |- estáticos (HTML/JS)
                                |- /api/* (auth, firestore, storage, functions)
                                |- /ws (WebSocket realtime)
                                |- MongoDB en localhost:27017
                                |- archivos en server/uploads/
```

## 1. En el VPS: instalar dependencias (Ubuntu/Debian)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs git nginx

# MongoDB 8 (repo oficial)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

## 2. Código

```bash
sudo mkdir -p /opt/gesbase && sudo chown $USER /opt/gesbase
cd /opt/gesbase
git clone https://github.com/albeservicios/GESBASE.git .
cd server && npm install --omit=dev
```

## 3. Configurar .env (producción)

```bash
cp .env.example .env
# editar:
#   PUBLIC_URL=https://tudominio.com
#   (Twilio/Resend/Gemini cuando los definas)
```

## 4. Pasar los datos (desde tu Mac)

```bash
# en tu Mac, dentro del repo:
rsync -avz server/data/export/ usuario@VPS:/opt/gesbase/server/data/export/
# en el VPS:
cd /opt/gesbase/server && npm run import:mongo
```

## 5. Servicio systemd

```bash
sudo cp deploy/gesbase.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gesbase
journalctl -u gesbase -f   # ver logs
```

## 6. nginx (proxy inverso + WebSocket)

```bash
sudo cp deploy/nginx-gesbase.conf /etc/nginx/sites-available/gesbase
sudo ln -s /etc/nginx/sites-available/gesbase /etc/nginx/sites-enabled/
# editar server_name -> tu dominio
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Cloudflare

- DNS: registro `A` -> IP del VPS, proxy ON (nube naranja) = TLS gratis
- SSL/TLS mode: **Full** (o Full strict con Origin Certificate)
- WebSocket funciona a través del proxy de CF sin config extra

## 8. Persistencia / backups

- DB: `server/data` no se usa en VPS (mongod real guarda en
  /var/lib/mongodb) — backup con `mongodump`
- Archivos: `server/uploads/` — incluir en backups
- Para redeploy de código: `git pull && npm install --omit=dev &&
  sudo systemctl restart gesbase`
