# -----------------------------
# STAGE 1: Build
# -----------------------------
FROM node:20-bullseye AS builder

WORKDIR /app

# Copia i file di configurazione e dipendenze
COPY package*.json tsconfig.json ./

# Installa le dipendenze SENZA eseguire gli script (prepare)
RUN npm ci --ignore-scripts

# Copia il codice sorgente
COPY src ./src
COPY instructions.md ./

# Ora esegui il build manualmente
RUN npm run build

# -----------------------------
# STAGE 2: Runtime
# -----------------------------
FROM node:20-slim AS runtime

WORKDIR /app

# Copia i file necessari dal builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/instructions.md ./instructions.md

# Installa solo le dipendenze di produzione
RUN npm ci --omit=dev --ignore-scripts

# Espone la porta
EXPOSE 3002

# Comando di avvio
CMD ["node", "dist/index.js", "http"]