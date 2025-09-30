import { DB } from "./db.js";
async function main() {
    let db;
    try {
        db = new DB();
    }
    catch {
        console.error("Missing env variables");
        process.exit(1);
    }
    const res = await db.test();
    console.log("Test result:", res);
    await db.close();
}
main().catch(console.error);
