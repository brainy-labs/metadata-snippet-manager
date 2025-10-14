import neo4j, { Driver, Session } from "neo4j-driver";
import * as dotenv from 'dotenv';
import { 
    AddMetadataParentInput,
    CreateMetadataForestInput,
    CreateMetadataInput, 
    CreateMetadataSubtreeInput, 
    CreateMetadataTreeInput, 
    CreateSnippetInput, 
    DeleteMetadataInput, 
    DeleteSnippetsInput, 
    GetMetadataForestInput, 
    GetMetadataPathInput, 
    GetMetadataSiblingsForestInput, 
    GetMetadataSiblingsInput, 
    GetMetadataTreeInput,
    Metadata, 
    MetadataParentChildStatus, 
    MetadataParentChildSuccess, 
    MetadataPath, 
    MetadataSiblingsForest, 
    MetadataSiblingsList, 
    MetadataTreeNode,
    SearchSnippetByNameInput, 
    Snippet,
    upDateSnippetContentInput, 
} from "./schemas.js";

dotenv.config();

export class DB {
    private driver: Driver;
    /**
     * Initialize db driver
     */
    constructor() {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
            throw new Error(
                "Missing env variables"
            )
        } 

        this.driver = neo4j.driver(
            process.env.NEO4J_URI,
            neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
            {
                maxConnectionPoolSize: 20,
                connectionAcquisitionTimeout: 20000
            }
        );

        this.initialize();
    }

    /**
     * Initialize db with nodes constraints
     */ 
    async initialize(): Promise<void> {
        const session = this.driver.session();
        try {
            await this.create_field_constraint(session, "Snippet", "snippet_name_unique", "name");
            await this.create_field_constraint(session, "Metadata", "metadata_name_unique", "name");
            await this.create_index(session, "Metadata", "metadata_category", "category");
        } finally {
            await session.close();
        }
    }

    /**
     * 
     * @param input Metadata to create
     * @returns the Metadata created 
     */
    async createMetadata(input: CreateMetadataInput): Promise<Metadata> {
        const session = this.driver.session();
        try {
            // Check if metadata already exists
            const res = await session.run(`
                MATCH (m: Metadata)
                WHERE m.name = $name
                RETURN m
            `, {name: input.name});
            if (res.records.length > 0) throw new Error(`Name already taken`);

            // If there is a parent, verify it is from the same category
            if (input.parentName) {
                const parentCheck = await session.run(`
                    MATCH (p:Metadata {name: $parentName})
                    RETURN p.category as category
                `, { parentName: input.parentName });

                if (parentCheck.records.length === 0){
                    throw new Error(`Parent metadata '${input.parentName}' not found`);
                }

                const parentCategory = parentCheck.records[0].get('category');
                if(parentCategory !== input.category) {
                    throw new Error(
                        `Parent metadata category '${parentCategory}' doesn't match '${input.category}'`
                    );
                }
            }

            // Create metadata and parent relation if exists
            const result = await session.run(`
                MERGE (m:Metadata {name: $name})
                ON CREATE SET m.category = $category
                WITH m
                OPTIONAL MATCH (p:Metadata {name: $parentName})
                WHERE $parentName IS NOT NULL
                FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END |
                    MERGE (p)-[:PARENT_OF]->(m)
                )
                RETURN m
            `, {
                name: input.name,
                category: input.category,
                parentName: input.parentName || null
            });

            const record = result.records[0].get('m');
            return {
                name: record.properties.name,
                category: record.properties.category,
                parentName: input.parentName
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Delete a metadata. It doesn't throw error if metadata doesn't exist 
     * @param input name of metadata to delete 
     */
    async deleteMetadataByName(input: DeleteMetadataInput): Promise<void> {
        const session = this.driver.session();
        try{
            const res = await session.run(`UNWIND $names as name MATCH (m:Metadata {name: name}) DETACH DELETE m`, { names: input.names});
        } finally {
            await session.close();
        }
    }

    /**
     * Delete a snippet. It doesn't throw error if snippet doesn't exist 
     * @param input name of snippet to delete
     */
    async deleteSnippetsByName(input: DeleteSnippetsInput): Promise<void>{
        const session = this.driver.session();
        try {
            const res = await session.run(`UNWIND $names as name MATCH (s:Snippet {name: name}) DETACH DELETE s`, { names: input.names});
        } finally {
            await session.close();
        }
    }

    /**
     * Create a Snippet with the given metadata 
     * @param input Snippet to insert
     * @returns the Snippet inserted
     */
    async createSnippet(input: CreateSnippetInput): Promise<Snippet> {
        const session = this.driver.session();
        try{
            // Check if snippet already exists
            const res = await session.run(`MATCH (s:Snippet) WHERE s.name = $name RETURN s`, {name: input.name});
            if (res.records.length > 0) throw new Error(`Name already taken`);

            // Check metadata existence
            const metadataCheck = await session.run(`MATCH (m:Metadata) WHERE m.name IN $names AND m.category = $category RETURN m.name as name`, 
            { 
                names: input.metadataNames,
                category: input.category
            });

            if (metadataCheck.records.length !== input.metadataNames.length) {
                throw new Error(`Some metadata names don't exists`);
            }

            // Insert snippet in database
            const result = await session.run(`
                CREATE (s:Snippet {
                    name: $name,
                    content: $content,
                    extension: $extension,
                    size: $size,
                    createdAt: datetime()
                })
                WITH s
                UNWIND $metadataNames as metadataName
                MATCH (m: Metadata {name: metadataName})
                MERGE (s)-[:HAS_METADATA]->(m)
                RETURN s 
            `, {
                name: input.name, 
                content: input.content,
                extension: input.extension,
                size: input.content.length,
                metadataNames: input.metadataNames
            });

            const record = result.records[0];
            const snippet = record.get('s');

            console.error(snippet.properties);
            return {...snippet.properties, metadataNames: input.metadataNames};
        } 
        finally {
            await session.close();
        }
    }

    /** 
     * Get all metadata from db
     * @returns an array of all metadata
     */
    async getAllMetadata(): Promise<Metadata[]> {
        const session = this.driver.session();
        try {
            const res = await session.run(`MATCH (m:Metadata) RETURN m`);
            
            const response: Metadata[] = res.records.map(record => {
                const node = record.get('m');
                return node.properties as Metadata;
            });

            return response;
        } finally {
            await session.close();
        }
    }

    /**
     * Get all snippets from db with metadata
     * @returns an array of all snippets 
     */
    async getAllSnippets(): Promise<Snippet[]> {
        const session = this.driver.session();
        try{
            const res = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WITH s, collect(DISTINCT m.category) AS categories, collect(DISTINCT m.name) AS metadataNames
                RETURN {
                    name: s.name,
                    content: s.content,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: metadataNames
                } AS s
            `);

            const response = res.records.map(record => {
                const node = record.get('s');
                const snippet: Snippet = node;
                return snippet;
            });
            
            return response;
        } finally {
            await session.close();
        }
    }

    /**
     * @param input name of snippet
     * @returns a snippet with its metadata
     */
    async searchSnippetByName(input: SearchSnippetByNameInput): Promise<Snippet> {
        const session = this.driver.session();
        try {
            const res = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WHERE s.name = $name
                WITH s, collect(DISTINCT m.category) AS categories, collect(DISTINCT m.name) AS metadataNames
                RETURN {
                    name: s.name,
                    content: s.content,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: metadataNames
                } AS s`, { 
                    name: input.name,
                });
            
            if (res.records.length === 0) {
                throw new Error(`Snippet doesn't exist`);
            }
            
            const s = res.records[0].get('s');
            const snippet: Snippet = s;
            return snippet;
        } finally {
            await session.close();
        }
    }

    /**
     * Update the content of an existent snippet 
     * @param input name and content of snippet
     * @returns the updated snippet
     */
    async updateSnippetContent(input: upDateSnippetContentInput): Promise<Snippet> {
        const session = this.driver.session();
        try {
            const res = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WHERE s.name = $name
                SET s.content = $content, s.size = $size
                WITH s, collect(DISTINCT m.category) AS categories, collect(DISTINCT m.name) AS metadataNames
                RETURN {
                    name: s.name,
                    content: s.content,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: metadataNames
                } AS s`, { 
                    name: input.name,
                    content: input.content,
                    size: input.content.length
                });
            
            if (res.records.length === 0) {
                throw new Error(`Snippet doesn't exist`);
            }
            
            const s = res.records[0].get('s');
            const snippet: Snippet = s;
            return snippet;
        } finally {
            await session.close();
        }
    }

    /**
     * Get metadata tree and the category by the root name 
     * @param input the root name 
     * @returns the whole tree and the category of all metadata 
     */
    async getMetadataTree(input: GetMetadataTreeInput): Promise<MetadataTreeNode> {
        const session = this.driver.session();
        try{
            const rootCheck = await session.run(`
                MATCH (m:Metadata {name: $name})
                RETURN m.category as category
            `, { name: input.name });

            if (rootCheck.records.length === 0) {
                throw new Error(`Metadata '${input.name}' not found`);
            }

            const category = rootCheck.records[0].get('category');

            const result = await session.run(`
                MATCH path = (root:Metadata {name: $name})-[:PARENT_OF*0..]->(descendant:Metadata)
                WITH root, descendant,
                    [rel in relationships(path) | rel] as rels,
                    length(path) as depth
                ORDER BY depth
                WITH collect({
                    name: descendant.name,
                    depth: depth,
                    parentName: CASE
                        WHEN depth > 0
                        THEN [rel in rels | startNode(rel).name][-1]
                        ELSE null
                    END
                }) as nodes
                RETURN nodes
            `, { name: input.name });

            const nodes = result.records[0].get('nodes');

            const nodeMap = new Map<string, MetadataTreeNode>();

            nodes.forEach((node: any) => {
                nodeMap.set(node.name, {
                    name: node.name,
                    children: []
                });
            });

            let root: MetadataTreeNode | null = null;
            nodes.forEach((node: any) => {
                const currentNode = nodeMap.get(node.name)!;

                if (node.parentName === null) {
                    root = currentNode;
                } else {
                    const parent = nodeMap.get(node.parentName);
                    if (parent) {
                        parent.children.push(currentNode);
                    }
                }
            });

            if (!root) {
                throw new Error(`Failed to build tree structure`);
            }
            
            return {
                category: category,
                root: root
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Create a metadata tree by a JSON structure
     * @param input the metadata tree and the category
     * @returns The metadata tree created
     */
    async createMetadataTree(input: CreateMetadataTreeInput): Promise<MetadataTreeNode> {
        const session = this.driver.session();
        try {
            const rootCheck = await session.run(`
                MATCH (m:Metadata {name: $name})
                RETURN m
            `, { name: input.root.name });

            if (rootCheck.records.length > 0) {
                throw new Error(`Root metadata '${input.root.name}' already exists`);
            }

            type treeNode = { name: string;  parentName: string | null };

            const flatNodes: Array<treeNode> = [];

            const flatten = (node: MetadataTreeNode, parentName: string | null = null) => {
                flatNodes.push({
                    name: node.name,
                    parentName: parentName
                });

                node.children.forEach((child: treeNode) => flatten(child, node.name));
            };

            flatten(input.root);

            const names = flatNodes.map(n => n.name);
            const uniqueNames = new Set(names);
            if (names.length !== uniqueNames.size) {
                throw new Error('Duplicate names found in subtree');
            }

            const existingCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name IN $names
                RETURN m.name as name
            `, { names: names });

            if (existingCheck.records.length > 0) {
                const existing = existingCheck.records.map(r => r.get('name'));
                throw new Error(`Some metadata already exists: ${existing.join(', ')}`);
            }

            await session.run(`
                UNWIND $nodes as node
                MERGE (m:Metadata {name: node.name, category: $category})
                WITH m, node
                WHERE node.parentName IS NOT NULL
                MATCH (p:Metadata {name: node.parentName})
                MERGE (p)-[:PARENT_OF]->(m)
            `, { 
                nodes: flatNodes,
                category: input.category, 
            });

            return {
                category: input.category,
                root: input.root
            }
        } finally {
            await session.close();
        }
    }

    /**
     * Create a metadata tree by and existing root
     * @param input the root and the tree
     * @returns the root name, the category of the whole tree and the children count added
     */
    async createMetadataSubtree(input: CreateMetadataSubtreeInput): Promise<{
        rootName: string;
        category: string;
        childrenCount: number
    }> {
        const session = this.driver.session();
        try {
            const rootCheck = await session.run(`
                MATCH (m:Metadata {name: $rootName})
                RETURN m.category as category
            `, { rootName: input.rootName });

            if (rootCheck.records.length === 0) {
                throw new Error(`Root metadata '${input.rootName}' not found`);
            }

            const category = rootCheck.records[0].get('category');

            const flatNodes: Array<{ name: string; parentName: string }> = [];

            const flatten = (node: MetadataTreeNode, parentName: string) => {
                flatNodes.push({
                    name: node.name,
                    parentName: parentName
                });

                node.children.forEach((child: MetadataTreeNode) => flatten(child, node.name));
            };

            input.children.forEach(child => flatten(child, input.rootName));

            const names = flatNodes.map(n => n.name);
            const uniqueNames = new Set(names);
            if (names.length !== uniqueNames.size) {
                throw new Error('Duplicate names found in subtree');
            }

            const existingCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name IN $names
                RETURN m.name as name
            `, { names: names });

            if (existingCheck.records.length > 0) {
                const existing = existingCheck.records.map(r => r.get('name'));
                throw new Error(`Some metadata already exists: ${existing.join(', ')}`);
            }

            await session.run(`
                UNWIND $nodes as node
                CREATE (m:Metadata {name: node.name, category: $category})
                WITH m, node
                MATCH (p:Metadata {name: node.parentName})
                MERGE (p)-[:PARENT_OF]->(m)
            `, {
               nodes: flatNodes,
               category: category 
            });

            return {
                rootName: input.rootName,
                category: category,
                childrenCount: flatNodes.length
            }
        } finally {
            await session.close();
        }
    }

    /**
     * Get siblings of a metadata (All metadata with the same parent)
     * If the input is a root, it returns an array with one single element, the root itself 
     * @param input a metadata name
     * @returns a list of siblings and the category of all siblings
     */
    async getMetadataSiblings(input: GetMetadataSiblingsInput) : Promise<MetadataSiblingsList> {
        const session: Session = this.driver.session();
        try{
            const siblingCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name = $name
                OPTIONAL MATCH (parent:Metadata)-[:PARENT_OF]->(m)
                RETURN m, parent.name AS p 
            `, { name: input.name });

            if (siblingCheck.records.length === 0) {
                throw new Error(`Metadata ${input.name} doesn't exist`);
            }

            const mainSib = siblingCheck.records[0].get('m').properties;
            const parent = siblingCheck.records[0].get('p');

            let siblings: string[] = [];
            if (parent === null) {
                siblings.push(mainSib.name);
            } else{
                const res = await session.run(`
                    MATCH (parent:Metadata)-[:PARENT_OF]->(m:Metadata)
                    WHERE parent.name = $parent
                    RETURN m.name as name
                `, { parent: parent });

                siblings = res.records.map(record => {
                    const name = record.get('name');
                    return name;
                });
            }

            return {
                category: mainSib.category,
                siblings: siblings
            }
        } finally {
            await session.close();
        }
    }

    /**
     * Create a metadata forest from a json object
     * @param input a list of trees with categories
     * @returns an array of objects telling the success of insetions of each tree and a variable telling if it's patial success, success or total failure (error) 
     */
    async createMetadataForest(input: CreateMetadataForestInput) {
        const results: Array<{name: string, status: string, error?: string}> = [];

        for (const tree of input.forest) {
            try{
                await this.createMetadataTree(tree);
                results.push({
                    name: tree.root.name,
                    status: "created"
                });
            } catch (err: any) {
                results.push({
                    name: tree.root.name,
                    status: "error",
                    error: err.message
                });
            }
        }
        
        let success: string = "partial success";
        if (results.every(r => r.status === "created")) success = "success";
        else if (results.every(r => r.status === "error")) success = "error";

        return {
            success,
            results
        };
    }

    /**
     * Get a metadata forest by the roots, it works for mid-nodes as well 
     * @param input a list of root names
     * @returns a json like forest
     */
    async getMetadataForest(input: GetMetadataForestInput): Promise<MetadataTreeNode[]> {
        const metadataForest = await Promise.all(
            input.names.map(name => this.getMetadataTree(name))
        );
        return metadataForest;
    }

    /**
     * Get the whole metadata forest 
     * @returns a list of all roots with their descendants 
     */
    async getWholeMetadataForest(): Promise<MetadataTreeNode[]> {
        const session = this.driver.session();
        let roots: GetMetadataForestInput = { names: [] };
        try {
            const res = await session.run(`
                MATCH (m:Metadata)
                WHERE NOT (m)<-[:PARENT_OF]-(:Metadata)
                RETURN m.name as name
            `);

            res.records.forEach(item => {
                roots.names.push({name: item.get('name')});
            });

            await session.close();
        } catch {
            await session.close();
            throw new Error(`Error getting roots`);
        }

        const wholeForest = await this.getMetadataForest(roots);
        return wholeForest;
    }

    async getMetadataPath(input: GetMetadataPathInput): Promise<MetadataPath> {
        const session = this.driver.session();
        try {
            // Check if metadata exists
            const metadataCheck = await session.run(`
                MATCH (m:Metadata {name: $name})
                RETURN m.category as category
            `, { name: input.name });

            if (metadataCheck.records.length === 0) 
                throw new Error(`Metadata '${input.name}' not found`);

            const category = metadataCheck.records[0].get('category');

            // Get path from the root to the target metadata
            const result = await session.run(`
                MATCH path = (root:Metadata)-[:PARENT_OF*0..]->(target:Metadata {name: $name})
                WHERE NOT (root)<-[:PARENT_OF]-(:Metadata)
                WITH path, length(path) as pathLength
                ORDER BY pathLength DESC
                LIMIT 1
                WITH [node in nodes(path) | node.name] as pathNames
                RETURN pathNames
            `, { name: input.name });

            if (result.records.length === 0) 
                throw new Error(`Failed to find path to metadata '${input.name}'`);

            const path = result.records[0].get('pathNames');

            return {
                category: category,
                path: path
            }
        } finally {
            await session.close();
        }
    }

    async getMetadataSiblingsForest(input: GetMetadataSiblingsForestInput): Promise<MetadataSiblingsForest> {
        // Get siblings of the input metadata
        const siblingsData = await this.getMetadataSiblings({ name: input.name });

        // Build the forest by getting each sibling's tree
        const forest: MetadataTreeNode[] = [];
        for (const siblingName of siblingsData.siblings) {
            const tree = await this.getMetadataTree({ name: siblingName });
            forest.push(tree.root);
        }

        return {
            category: siblingsData.category,
            forest: forest
        };
    }

    async AddMetadataParent(input: AddMetadataParentInput) : Promise<MetadataParentChildSuccess> {
        const results: MetadataParentChildStatus = [];

        for (const pair of input.pairs) {
           const session = this.driver.session();

            try {
                // Check if both nodes exists and get their categories
                const checkQuery = await session.run(`
                    MATCH (p: Metadata {name: $parentName})
                    MATCH (c:Metadata {name: $childName})
                    RETURN p.category as parentCategory, c.category as childCategory
                `, { parentName: pair.parentName, childName: pair.childName });

                if (checkQuery.records.length === 0) {
                    throw new Error(`One or both metadata nodes not found`);
                }

                const parentCategory = checkQuery.records[0].get('parentCategory');
                const childCategory = checkQuery.records[0].get('childCategory');

                if (parentCategory !== childCategory) {
                    throw new Error (`Category mismatch: parent is ${parentCategory}, child is ${childCategory}`);
                }

                // Check if child already has parent
                const hasParentQuery = await session.run(`
                    MATCH (c:Metadata {name: $childName})
                    MATCH (existing:Metadata)-[:PARENT_OF]->(c) 
                    RETURN existing.name as existingParent
                `, { childName: pair.childName });

                if (hasParentQuery.records.length > 0) {
                    const existingParent = hasParentQuery.records[0].get('existingParent');
                    throw new Error(`Child already has parent: ${existingParent}`);
                }

                // Create the parent-child relationship
                await session.run(`
                    MATCH (p:Metadata {name: $parentName})
                    MATCH (c:Metadata {name: $childName})
                    MERGE (p)-[:PARENT_OF]->(c)
                `, { parentName: pair.parentName, childName: pair.childName });

                results.push({
                    parentName: pair.parentName,
                    childName: pair.childName,
                    status: "created"
                });
            }
            catch (error: any) {
                results.push({
                    parentName: pair.parentName,
                    childName: pair.childName,
                    status: "error",
                    error: error.message
                });
            }
            finally {
                await session.close();
            }
        }

        let success: "error" | "success" | "partial success" = "partial success"; 
        if (results.every(r => r.status === "created")) success = "success";
        else if (results.every(r => r.status === "error")) success = "error";

        return {
            results: results,
            success: success
        }
       
    }

    /**
     * Clears database and storage
     */
    async clear(): Promise<void> {
        const session: Session = this.driver.session();
        try{
            await session.run("MATCH (n) DETACH DELETE n");

            const constraints = await session.run("SHOW CONSTRAINTS");
            for (const record of constraints.records) {
                const name = record.get("name");
                await session.run(`DROP CONSTRAINT ${name} IF EXISTS`);
            }

            const indexes = await session.run("SHOW INDEXES");
            for (const record of indexes.records) {
                const name = record.get("name");
                await session.run(`DROP INDEX ${name} IF EXISTS`);
            }

            console.log("Database cleared: nodes, relationships, constraints and indexes removed."); 
        } finally{
            await session.close();
        }
    }

    /**
     * Closes database connection
     */
    async close(): Promise<void> {
        await this.driver.close();
    }
    
    /**
     * Run a query that adds (if not exists) a constraint to the right field
     * @param session 
     * @param label 
     * @param constraint_name 
     * @param field 
     * @param type it can be a uniqueness constraint as well as a existence constraint
     */
    async create_field_constraint(
        session: Session, 
        label: string, 
        constraint_name: string, 
        field: string
    ): Promise<void> {
        await session.run(`
            CREATE CONSTRAINT ${constraint_name} IF NOT EXISTS
            FOR (${label[0].toLowerCase()}:${label}) REQUIRE ${label[0].toLowerCase()}.${field} IS UNIQUE
        `);
    }

    /**
     * Run a query that adds (if not exists) an index to the right field 
     * @param session 
     * @param label 
     * @param index_name 
     * @param field 
     */
    async create_index(
        session: Session,
        label: string,
        index_name: string,
        field: string 
    ): Promise<void> {
        // Index for metadata category
        await session.run(`
            CREATE INDEX ${index_name} IF NOT EXISTS 
            FOR (${label[0].toLowerCase()}:${label}) ON (${label[0].toLowerCase()}.${field})
        `);

    }

    /**
     * db connection test function
     * @returns if ok return 1 else returns -1
     */
    async test_db_connection(): Promise<number> {
        const session: Session = this.driver.session();
        try {
            const result = await session.run("RETURN 1 AS num");
            return result.records[0].get("num").toNumber();
        } catch {
            return -1;
        } finally {
            await session.close();
        }
    }

    /**
     * Run a custom query
     * @param query 
     * @param params 
     * @returns 
     */
    async runCustomQuery(query: string, params: any = {}) {
        const session: Session = this.driver.session();
        
        try{
            const result = await session.run(query, params);
            await session.close();
            return result;
        } catch { 
            await session.close(); 
            return [];
        }
    }
    
}