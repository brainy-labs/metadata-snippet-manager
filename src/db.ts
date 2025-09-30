import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password")
);

export async function test() {
  const session = driver.session();
  try {
    const result = await session.run("RETURN 1 AS num");
    console.log("Connessione OK:", result.records[0].get("num").toNumber());
  } finally {
    await session.close();
    await driver.close();
  }
}