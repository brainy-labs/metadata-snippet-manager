# -----------------------------
# STAGE 1: Build
# -----------------------------
FROM node:20-bullseye AS builder

# Imposta la working directory
WORKDIR /app

# Copia solo i file di dipendenze
COPY package*.json ./

# Installa le dipendenze SENZA eseguire gli script di ciclo di vita (es. "prepare")
# Questa è la modifica chiave per risolvere l'errore "tsc: not found"
RUN npm install --ignore-scripts

# Copia tutto il codice sorgente (incluso tsconfig.json e la cartella src)
COPY . .

# Ora che il codice è presente, esegui il build
RUN npm run build

# -----------------------------
# STAGE 2: Runtime
# -----------------------------
FROM node:20-slim AS runtime

# Imposta la working directory
WORKDIR /app

# Copia solo le parti necessarie dal builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# AGGIUNGI QUESTA RIGA per copiare instructions.md dove il codice lo cerca
COPY --from=builder /app/instructions.md /app/instructions.md

# Installa solo le dipendenze di produzione
RUN npm install --omit=dev --ignore-scripts

# Espone la porta
EXPOSE 3002

# Comando di avvio
CMD ["node", "dist/index.js", "http"]
