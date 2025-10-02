# Specifiche del progetto

## Nome (Provvisorio)
msm - Meta Snippet Manager

## Descrizione
Snippet manager basato su MCP server. Il software aiuta a gestire i propri snippet di codice in modo intelligente, attraverso metadati (etichette) descrittivi. Ci sono due macro-categorie: snippet di concetti e snippet di linguaggio. 
- Gli snippet di concetto servono a salvare del codice che abbia lo scopo di ricordare velocemente dei concetti trasversali ai linguaggi (risoluzione di un problema).
- Gli snippet di linguaggio servono a salvare del codice che abbia lo scopo di ricordare velocemente dei concetti inerenti a un linguaggio specifico (costrutti di linguaggi/librerie).

## Tecnologie
- NodeJS
- TypeScript
- MCP SDK
- Neo4j

## Funzionalità
### Metadati
- Creare un metadato di concetto/linguaggio
- Creare un albero di metadati
- Visualizzare un albero di metadati
- Eliminare un metadato
- Eliminare la connessione tra metadati
### Snippet
- Creare uno snippet - con metadati associati 
- Tradurre uno snippet di concetto in un altro linguaggio
- Modifica/inserimento/eliminazione di metadati dallo snippet
- Ricerca di snippet per nome
- Ricerca di snippet con metadati
### Ibrido
- Creare uno snippet con un albero di metadati

## Architettura
### Tools

## Database
Database a grafo: neo4j.