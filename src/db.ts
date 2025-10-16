import neo4j, { Driver, Session } from "neo4j-driver";
import * as dotenv from 'dotenv';
import { 
    AddMetadataParentInput,
    CreateMetadataForestInput,
    CreateMetadataInput, 
    CreateMetadataSubtreeInput, 
    CreateMetadataTreeInput, 
    CreateSnippetInput, 
    CreateSnippetTranslationInput, 
    DeleteMetadataInput, 
    DeleteSnippetsInput, 
    DeleteSnippetTranslationInput, 
    GetMetadataForestInput, 
    GetMetadataPathInput, 
    GetMetadataSiblingsForestInput, 
    GetMetadataSiblingsInput, 
    GetMetadataTreeInput,
    GetSnippetsByMetadataInput,
    GetSnippetTranslationInput,
    GetSnippetTranslationsInput,
    Metadata, 
    MetadataCategory, 
    MetadataParentChildStatus, 
    MetadataParentChildSuccess, 
    MetadataPath, 
    MetadataSiblingsForest, 
    MetadataSiblingsList, 
    MetadataTreeNode,
    PruneMetadataBranchInput,
    PruneMetadataNewTrees,
    RenameMetadataSchema,
    SearchSnippetByNameInput, 
    Snippet,
    SnippetWithMatchCount,
    SnippetWithTranslations,
    Translation,
    upDateSnippetContentInput,
    UpdateSnippetMetadataInput,
    UpdateSnippetTranslationInput, 
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
            await this.create_field_constraint(session, "Metadata", "metadata_name_category_unique", "name", "category");
            await this.create_index(session, "Metadata", "metadata_category", "category");

            await session.run(`
                CREATE CONSTRAINT translation_snippet_extension_unique IF NOT EXISTS
                FOR (t:Translation)
                REQUIRE (t.snippetName, t.extension) IS UNIQUE
            `);
        } finally {
            await session.close();
        }
    }

    /* ---------- Helpers ---------- */
    /**
     * Resolve a unique metadata category by name. If multiple categories exist for the name
     * throws an error asking the caller to disambiguate by providing category.
     * If categoryParam is provided, it is returned without further checks.
     */
    private async resolveCategoryForName(session: Session, name: string, categoryParam?: MetadataCategory): Promise<MetadataCategory> {
        if (categoryParam) return categoryParam;
        const res = await session.run(
            `MATCH (m:Metadata {name: $name}) RETURN collect(DISTINCT m.category) AS cats`,
            { name }
        );
        const cats = res.records[0].get('cats');
        if (!cats || cats.length === 0) throw new Error(`Metadata '${name}' not found`);
        if (cats.length > 1) throw new Error(`Multiple metadata with name '${name}' found in different categories. Please provide category explicitly.`);
        return cats[0];
    }

    /* ---------- End helpers ---------- */

    /**
     * 
     * @param input Metadata to create
     * @returns the Metadata created 
     */
    async createMetadata(input: CreateMetadataInput): Promise<Metadata> {
        const session = this.driver.session();
        try {
            // Check if metadata already exists (name+category)
            const res = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name = $name AND m.category = $category
                RETURN m
            `, { name: input.name, category: input.category });
            if (res.records.length > 0) throw new Error(`Name already taken`);

            // If there is a parent, verify it is from the same category
            if (input.parentName) {
                const parentCheck = await session.run(`
                    MATCH (p:Metadata {name: $parentName, category: $category})
                    RETURN p.category as category
                `, { parentName: input.parentName, category: input.category });

                if (parentCheck.records.length === 0){
                    throw new Error(`Parent metadata '${input.parentName}' not found in category '${input.category}'`);
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
                MERGE (m:Metadata {name: $name, category: $category})
                WITH m
                OPTIONAL MATCH (p:Metadata {name: $parentName, category: $category})
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
        const deleteParams = input.metadata.map(item => ({
            name: item.name,
            category: item.category
        }));

        try{
            await session.run(`
                UNWIND $items as item
                MATCH (m:Metadata {name: item.name, category: item.category})
                DETACH DELETE m
            `, { items: deleteParams });
        } finally {
            await session.close();
        }
    }

    /**
     * Delete a snippet. It doesn't throw error if snippet doesn't exist 
     * @param input name of snippet to delete
     */
    async deleteSnippetsByName(input: DeleteSnippetsInput): Promise<void>{
        
        for (const name of input.names) {
            await this.deleteAllSnippetTranslations(name);
        }

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

            // Check metadata existence (ensures metadata in the provided category exist)
            const metadataCheck = await session.run(`MATCH (m:Metadata) WHERE m.name IN $names AND m.category = $category RETURN m.name as name`, 
            { 
                names: input.metadataNames,
                category: input.category
            });

            if (metadataCheck.records.length !== input.metadataNames.length) {
                throw new Error(`Some metadata names don't exists in category '${input.category}'`);
            }

            // Insert snippet in database and link with metadata (matching by name+category)
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
                MATCH (m: Metadata {name: metadataName, category: $category})
                MERGE (s)-[:HAS_METADATA]->(m)
                RETURN s 
            `, {
                name: input.name, 
                content: input.content,
                extension: input.extension,
                size: input.content.length,
                metadataNames: input.metadataNames,
                category: input.category
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
            // Resolve category (if not provided, ensure unique by name)
            const category = await this.resolveCategoryForName(session, input.name, (input as any).category);

            const maxDepth = input.maxDepth ?? -1;

            // build query in a dinamic way for maxDepth
            const depthClause = maxDepth === -1 ? '*0..' : `*0..${maxDepth}`;

            const result = await session.run(`
                MATCH path = (root:Metadata {name: $name, category: $category})-[:PARENT_OF${depthClause}]->(descendant:Metadata {category: $category})
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
            `, { name: input.name, category });

            const nodes = result.records[0].get('nodes');

            // Build hierachic schema from a list of records
            const nodeMap = new Map<string, MetadataTreeNode>();

            nodes.forEach((node: any) => {
                nodeMap.set(node.name, {
                    name: node.name,
                    children: []
                });
            });

            let rootNode: MetadataTreeNode | null = null;
            nodes.forEach((node: any) => {
                const currentNode = nodeMap.get(node.name)!;

                if (node.parentName === null) {
                    rootNode = currentNode;
                } else {
                    const parent = nodeMap.get(node.parentName);
                    if (parent) {
                        parent.children.push(currentNode);
                    }
                }
            });

            if (!rootNode) {
                throw new Error(`Failed to build tree structure`);
            }
            
            return {
                category: category,
                root: rootNode
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
                MATCH (m:Metadata {name: $name, category: $category})
                RETURN m
            `, { name: input.root.name, category: input.category });

            if (rootCheck.records.length > 0) {
                throw new Error(`Root metadata '${input.root.name}' already exists in category '${input.category}'`);
            }

            type treeNode = { name: string;  parentName: string | null };

            const flatNodes: Array<treeNode> = [];

            // Flat nodes to insert into database
            const flatten = (node: MetadataTreeNode, parentName: string | null = null) => {
                flatNodes.push({
                    name: node.name,
                    parentName: parentName
                });

                node.children.forEach((child: any) => flatten(child, node.name));
            };

            flatten(input.root);

            const names = flatNodes.map(n => n.name);
            const uniqueNames = new Set(names);
            if (names.length !== uniqueNames.size) {
                throw new Error('Duplicate names found in subtree');
            }

            // Check if metadata already exist in the same category
            const existingCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name IN $names AND m.category = $category
                RETURN m.name as name
            `, { names: names, category: input.category });

            if (existingCheck.records.length > 0) {
                const existing = existingCheck.records.map(r => r.get('name'));
                throw new Error(`Some metadata already exists in category '${input.category}': ${existing.join(', ')}`);
            }

            // Insert nodes (merge by name+category)
            await session.run(`
                UNWIND $nodes as node
                MERGE (m:Metadata {name: node.name, category: $category})
                WITH m, node
                WHERE node.parentName IS NOT NULL
                MATCH (p:Metadata {name: node.parentName, category: $category})
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
            // Resolve root and its category (ensure unique)
            const rootCheck = await session.run(`
                MATCH (m:Metadata {name: $rootName})
                RETURN collect(DISTINCT m.category) AS cats
            `, { rootName: input.rootName });

            const cats = rootCheck.records[0].get('cats');
            if (!cats || cats.length === 0) {
                throw new Error(`Root metadata '${input.rootName}' not found`);
            }
            if (cats.length > 1) {
                throw new Error(`Multiple metadata with name '${input.rootName}' found in different categories. Please provide category.`);
            }

            const category = cats[0];

            // flat nodes to insert into db
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

            // Check if metadata already exist in the same category
            const existingCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name IN $names AND m.category = $category
                RETURN m.name as name
            `, { names: names, category });

            if (existingCheck.records.length > 0) {
                const existing = existingCheck.records.map(r => r.get('name'));
                throw new Error(`Some metadata already exists in category '${category}': ${existing.join(', ')}`);
            }

            // insert nodes
            await session.run(`
                UNWIND $nodes as node
                CREATE (m:Metadata {name: node.name, category: $category})
                WITH m, node
                MATCH (p:Metadata {name: node.parentName, category: $category})
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
            // Resolve category (if ambiguous, requester must provide category)
            const category = await this.resolveCategoryForName(session, input.name, (input as any).category);

            // Check if the given metadata exists and get the parent (if exists)
            const siblingCheck = await session.run(`
                MATCH (m:Metadata {name: $name, category: $category})
                OPTIONAL MATCH (parent:Metadata {category: $category})-[:PARENT_OF]->(m)
                RETURN m, parent.name AS p 
            `, { name: input.name, category });

            if (siblingCheck.records.length === 0) {
                throw new Error(`Metadata ${input.name} doesn't exist in category '${category}'`);
            }

            const mainSib = siblingCheck.records[0].get('m').properties;
            const parent = siblingCheck.records[0].get('p');

            let siblings: string[] = [];
            // If parent doesn't exist, the list has only an item: the metadata in input
            if (parent === null) {
                siblings.push(mainSib.name);
            } else{ // else get all the metadata with the obtained parent
                const res = await session.run(`
                    MATCH (parent:Metadata {name: $parent, category: $category})-[:PARENT_OF]->(m:Metadata {category: $category})
                    RETURN m.name as name
                `, { parent: parent, category });

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

        // Just loop on the createMetadataTree function
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

        // Get all roots
        try {
            const res = await session.run(`
                MATCH (m:Metadata)
                WHERE NOT (m)<-[:PARENT_OF]-(:Metadata)
                RETURN m.name as name, m.category as category
            `);

            res.records.forEach(item => {
                roots.names.push({name: item.get('name'), category: item.get('category'), maxDepth: -1 } as any);
            });

            await session.close();
        } catch {
            await session.close();
            throw new Error(`Error getting roots`);
        }

        const wholeForest = await this.getMetadataForest(roots);
        return wholeForest;
    }

    /**
     * Get the path to the metadata in input.  
     * @param input a metadata name
     * @returns an ordered list. The first item is the root, the last item is the metadata in input.
     */
    async getMetadataPath(input: GetMetadataPathInput): Promise<MetadataPath> {
        const session = this.driver.session();
        try {
            // Resolve category (if not provided)
            const category : MetadataCategory = await this.resolveCategoryForName(session, input.name, (input as any).category);

            // Get path from the root to the target metadata
            const result = await session.run(`
                MATCH path = (root:Metadata {category: $category})-[:PARENT_OF*0..]->(target:Metadata {name: $name, category: $category})
                WHERE NOT (root)<-[:PARENT_OF]-(:Metadata {category: $category})
                WITH path, length(path) as pathLength
                ORDER BY pathLength DESC
                LIMIT 1
                WITH [node in nodes(path) | node.name] as pathNames
                RETURN pathNames
            `, { name: input.name, category });

            if (result.records.length === 0) 
                throw new Error(`Failed to find path to metadata '${input.name}' in category '${category}'`);

            const path = result.records[0].get('pathNames');

            return {
                category: category,
                path: path
            }
        } finally {
            await session.close();
        }
    }

    /**
     * Get a tree for each sibling of the specified metadata item (included its tree).
     * @param input a metadata name
     * @returns a forest of metadata which roots are the siblings of the metadata item. If a given metadata is a leaf, the tree has only the root
     */
    async getMetadataSiblingsForest(input: GetMetadataSiblingsForestInput): Promise<MetadataSiblingsForest> {
        // Get siblings of the input metadata
        const siblingsData = await this.getMetadataSiblings({ name: input.name, ...( (input as any).category ? { category: (input as any).category } : {}) });

        // Build the forest by getting each sibling's tree
        const forest: MetadataTreeNode[] = [];
        for (const siblingName of siblingsData.siblings) {
            const tree = await this.getMetadataTree({ name: siblingName, maxDepth: input.maxDepth, category: siblingsData.category } as any);
            forest.push(tree.root);
        }

        return {
            category: siblingsData.category,
            forest: forest
        };
    }

    /**
     * Add a parent to a metadata item (if it doesn't have any parent).
     * @param input the metadata item that will be parent and the metadata item that has no parent
     * @returns 
     */
    async addMetadataParent(input: AddMetadataParentInput) : Promise<MetadataParentChildSuccess> {
        const results: MetadataParentChildStatus = [];

        for (const pair of input.pairs) {
           const session = this.driver.session();

            try {
                // Resolve parent and child categories and ensure uniqueness
                const parentCatsRes = await session.run(`MATCH (p:Metadata {name: $parentName}) RETURN collect(DISTINCT p.category) AS cats`, { parentName: pair.parentName });
                const parentCats = parentCatsRes.records[0].get('cats');
                if (!parentCats || parentCats.length === 0) throw new Error(`Parent metadata '${pair.parentName}' not found`);
                if (parentCats.length > 1) throw new Error(`Multiple parent metadata with name '${pair.parentName}' found. Please provide category.`);
                const parentCategory = parentCats[0];

                const childCatsRes = await session.run(`MATCH (c:Metadata {name: $childName}) RETURN collect(DISTINCT c.category) AS cats`, { childName: pair.childName });
                const childCats = childCatsRes.records[0].get('cats');
                if (!childCats || childCats.length === 0) throw new Error(`Child metadata '${pair.childName}' not found`);
                if (childCats.length > 1) throw new Error(`Multiple child metadata with name '${pair.childName}' found. Please provide category.`);
                const childCategory = childCats[0];

                if (parentCategory !== childCategory) {
                    throw new Error (`Category mismatch: parent is ${parentCategory}, child is ${childCategory}`);
                }

                const category = parentCategory;

                // Check if child already has parent
                const hasParentQuery = await session.run(`
                    MATCH (c:Metadata {name: $childName, category: $category})
                    MATCH (existing:Metadata {category: $category})-[:PARENT_OF]->(c) 
                    RETURN existing.name as existingParent
                `, { childName: pair.childName, category });

                if (hasParentQuery.records.length > 0) {
                    const existingParent = hasParentQuery.records[0].get('existingParent');
                    throw new Error(`Child already has parent: ${existingParent}`);
                }

                // Create the parent-child relationship (match by name+category)
                await session.run(`
                    MATCH (p:Metadata {name: $parentName, category: $category})
                    MATCH (c:Metadata {name: $childName, category: $category})
                    MERGE (p)-[:PARENT_OF]->(c)
                `, { parentName: pair.parentName, childName: pair.childName, category });

                // Get the parent tree
                const parentTree = await this.getMetadataTree({ name: pair.parentName, maxDepth: -1, category } as any);

                results.push({
                    parentName: pair.parentName,
                    childName: pair.childName,
                    parentTree: parentTree,
                    status: "created"
                });
            } catch (error: any) {
                results.push({
                    parentName: pair.parentName,
                    childName: pair.childName,
                    status: "error",
                    error: error.message
                });
            } finally {
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
     * Break the kinship bond between a parent metadata and a child metadata 
     * @param input the names of the metadata child and parent
     * @returns the new trees. The ex-parent tree and the ex-child tree.
     */
    async pruneMetadataBranch(input: PruneMetadataBranchInput) : Promise<PruneMetadataNewTrees> {
        const session = this.driver.session();
        try {
            // Resolve categories and uniqueness for parent and child
            const parentCatsRes = await session.run(`MATCH (p:Metadata {name: $parentName}) RETURN collect(DISTINCT p.category) AS cats`, { parentName: input.parentName });
            const parentCats = parentCatsRes.records[0].get('cats');
            if (!parentCats || parentCats.length === 0) throw new Error(`Parent metadata '${input.parentName}' not found`);
            if (parentCats.length > 1) throw new Error(`Multiple parent metadata with name '${input.parentName}' found. Please provide category.`);
            const parentCategory = parentCats[0];

            const childCatsRes = await session.run(`MATCH (c:Metadata {name: $childName}) RETURN collect(DISTINCT c.category) AS cats`, { childName: input.childName });
            const childCats = childCatsRes.records[0].get('cats');
            if (!childCats || childCats.length === 0) throw new Error(`Child metadata '${input.childName}' not found`);
            if (childCats.length > 1) throw new Error(`Multiple child metadata with name '${input.childName}' found. Please provide category.`);
            const childCategory = childCats[0];

            if (parentCategory !== childCategory) throw new Error(`Parent and child belong to different categories`);
            const category = parentCategory;

            // Check if the relationship exists
            const relationQuery = await session.run(`
                MATCH (p:Metadata {name: $parentName, category: $category})-[r:PARENT_OF]->(c:Metadata {name: $childName, category: $category})
                RETURN r
            `, { parentName: input.parentName, childName: input.childName, category });

            if (relationQuery.records.length === 0) 
                throw new Error(`No parent-child relationship exists between '${input.parentName}' and '${input.childName}' in category '${category}'`);

            // Remove the parent-child relationship
            await session.run(`
                MATCH (p:Metadata {name: $parentName, category: $category})-[r:PARENT_OF]->(c:Metadata {name: $childName, category: $category})
                DELETE r
            `, { parentName: input.parentName, childName: input.childName, category });
        } finally {
            await session.close();
        }

        const parentTree = await this.getMetadataTree({ name: input.parentName, maxDepth: -1 } as any);
        const childTree = await this.getMetadataTree({ name: input.childName, maxDepth: -1  } as any);

        return {
            parentTree: parentTree,
            childTree: childTree
        };
    }

    async renameMetadata(input: RenameMetadataSchema) : Promise<Metadata> {
        const session = this.driver.session();
        try {
            // Verify old metadata exists
            const oldCheck = await session.run(`
                MATCH (m:Metadata {name: $oldName, category: $category})
                RETURN m
            `, { oldName: input.oldName, category: input.category });

            if (oldCheck.records.length === 0) 
                throw new Error(`Metadata '${input.oldName}' in category '${input.category}' not found`);

            // Verify new name doesn't exist in the same category
            const newCheck = await session.run(`
                MATCH (m:Metadata {name: $newName, category: $category})
                RETURN m
            `, { newName: input.newName, category: input.category });

            if (newCheck.records.length > 0)
                throw new Error(`Metadata '${input.newName}' already exists in category '${input.category}'`);

            const result = await session.run(`
                MATCH (m:Metadata {name: $oldName, category: $category})
                SET m.name = $newName
                RETURN m
            `, {
                oldName: input.oldName,
                newName: input.newName,
                category: input.category
            });

            const record = result.records[0].get('m');
            return {
                name: record.properties.name,
                category: record.properties.category
            };
        } finally {
            await session.close();
        }
    }

    /**
     * Get a list of snippets by a list of metadata. Each snippet has all the input metadata 
     * @param input a list of metadata names and a category
     * @returns a list of snippets having all the metadata in input. 
     *          The list is sorted in ascending order based on the length of the snippets' metadata lists
     */
    async getSnippetByMetadataSubset(input: GetSnippetsByMetadataInput) : Promise<Snippet[]> {
        const session: Session = this.driver.session();
        try {
            // Verify all metadata exists and belong to the same category
            const metadataCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name IN $metadataNames AND m.category = $category
                RETURN count(m) as count
            `, { metadataNames: input.metadataNames, category: input.category });

            const foundCount = metadataCheck.records[0].get('count').toNumber();
            if (foundCount !== input.metadataNames.length) {
                throw new Error(`Some metadata don't exists or don't match the category`);
            }

            // Find the snippets that have ALL the specified metadata (matching by name+category)
            const result = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WHERE m.name IN $metadataNames AND m.category = $category
                WITH s, collect(DISTINCT m.name) as matchedMetadata
                WHERE size(matchedMetadata) = $requiredCount
                MATCH (s)-[:HAS_METADATA]->(allMeta:Metadata {category: $category})
                WITH s, collect(DISTINCT allMeta.category) as categories,
                    collect(DISTINCT allMeta.name) as allMetadataNames
                ORDER BY size(allMetadataNames) ASC
                RETURN {
                    name: s.name,
                    content: s.content,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: allMetadataNames
                } AS snippet
            `, { metadataNames: input.metadataNames, requiredCount: input.metadataNames.length, category: input.category });

            return result.records.map(record => {
                const snippet = record.get('snippet');
                return snippet as Snippet;
            });
        } finally {
            await session.close();
        }
    }

    /**
     * Get a list of snippets by a metadata list. Each snippet's metadata list has a non-empty intersection with the given metadata list. 
     * @param input a metadata names list and a category.
     * @returns A list of snippets sorted in a descending order based on the cardinality of intersection with the metadata list in input.
     */
    async getSnippetsByMetadataIntersection(input: GetSnippetsByMetadataInput) : Promise<SnippetWithMatchCount[]>{
        const session: Session = this.driver.session();
        try {
            // Verify all metadata exists and belong to the same category
            const metadataCheck = await session.run(`
                MATCH (m:Metadata)
                WHERE m.name IN $metadataNames AND m.category = $category
                RETURN count(m) as count
            `, { metadataNames: input.metadataNames, category: input.category });

            const foundCount = metadataCheck.records[0].get('count').toNumber();
            if (foundCount !== input.metadataNames.length) {
                throw new Error(`Some metadata don't exists or don't match the category`);
            }

            // Find snippets that have at least one of the specified metadata
            // and count how many matches each snippet has (matching by name+category)
            const result = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WHERE m.name IN $metadataNames AND m.category = $category
                WITH s, collect(DISTINCT m.name) as matchedMetadata
                WITH s, matchedMetadata, size(matchedMetadata) as matchCount
                MATCH (s)-[:HAS_METADATA]->(allMeta:Metadata {category: $category})
                WITH s, matchCount, collect(DISTINCT allMeta.category) as categories,
                    collect(DISTINCT allMeta.name) as allMetadataNames
                RETURN {
                    name: s.name,
                    content: s.content,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: allMetadataNames
                } AS snippet, 
                matchCount
                ORDER BY matchCount DESC
            `, {
                metadataNames: input.metadataNames,
                category: input.category
            });

            return result.records.map(record => {
                const snippet = record.get('snippet');
                const matchCount = record.get('matchCount').toNumber();
                return {
                    snippet: snippet as Snippet,
                    matchCount: matchCount
                };
            });
        } finally {
            await session.close();
        }
    }

    async updateSnippetMetadata(input: UpdateSnippetMetadataInput) : Promise<Snippet> {
        const session = this.driver.session();
        try {
            // Check if snippet exists
            const snippetCheck = await session.run(
                `MATCH (s:Snippet {name: $name}) RETURN s`,
                { name: input.name }
            );

            if (snippetCheck.records.length === 0) {
                throw new Error(`Snippet '${input.name}' doesn't exist`);
            }

            // Check if all metadata exist and belong to the specified category
            const metadataCheck = await session.run(
                `MATCH (m:Metadata) WHERE m.name IN $names AND m.category = $category RETURN m.name as name`,
                {
                    names: input.metadataNames,
                    category: input.category
                }
            );

            if (metadataCheck.records.length !== input.metadataNames.length) {
                throw new Error(`Some metadata don't exist or don't match the category`);
            }

            // Remove all existing metadata relationships
            await session.run(
                `MATCH (s:Snippet {name: $name})-[r:HAS_METADATA]->(:Metadata) DELETE r`,
                { name: input.name }
            );

            // Create new metadata relationships (match metadata by name+category)
            const result = await session.run(`
                MATCH (s:Snippet {name: $name})
                WITH s
                UNWIND $metadataNames as metadataName
                MATCH (m:Metadata {name: metadataName, category: $category})
                MERGE (s)-[:HAS_METADATA]->(m)
                WITH s
                MATCH (s)-[:HAS_METADATA]->(m:Metadata {category: $category})
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
            `, {
                name: input.name,
                metadataNames: input.metadataNames,
                category: input.category
            });

            const snippet = result.records[0].get('s');
            return snippet as Snippet;
        } finally {
            await session.close();
        }
    }

    async createSnippetTranslation(input: CreateSnippetTranslationInput): Promise<Translation> {
        const session = this.driver.session();
        try {
            // Verify snippet exists
            const snippetCheck = await session.run(`
                MATCH (s:Snippet {name: $snippetName})
                RETURN s
            `, { snippetName: input.snippetName });

            if (snippetCheck.records.length === 0) {
                throw new Error(`Snippet '${input.snippetName}' doesn't exist`);
            }

            // Check if translation already exists for this extension
            const translationCheck = await session.run(`
                MATCH (s:Snippet {name: $snippetName})-[t:HAS_TRANSLATION]->()
                WHERE t.extension = $extension
                RETURN t
            `, { 
                snippetName: input.snippetName,
                extension: input.extension
            });

            if (translationCheck.records.length > 0) {
                throw new Error(`Translation for extension '${input.extension}' already exists for snippet '${input.snippetName}'`);
            }

            // Create translation as a relationship property
            const result = await session.run(`
                MATCH (s:Snippet {name: $snippetName})
                CREATE (t:Translation {
                    extension: $extension,
                    content: $content,
                    translatedAt: datetime(),
                    snippetName: $snippetName
                })
                CREATE (s)-[:HAS_TRANSLATION]->(t)
                RETURN t
            `, {
                snippetName: input.snippetName,
                extension: input.extension,
                content: input.content
            });

            const translation = result.records[0].get('t').properties;
            
            return {
                extension: translation.extension,
                content: translation.content,
                translatedAt: translation.translatedAt,
                snippetName: translation.snippetName
            };
        } finally {
            await session.close();
        }
    }

    async updateSnippetTranslation(input: UpdateSnippetTranslationInput): Promise<Translation> {
        const session = this.driver.session();
        try {
            // Check if snippet and translation exist
            const result = await session.run(`
                MATCH (s:Snippet {name: $snippetName})-[:HAS_TRANSLATION]->(t:Translation {extension: $extension})
                SET t.content = $content, t.translatedAt = datetime()
                RETURN t
            `, {
                snippetName: input.snippetName,
                extension: input.extension,
                content: input.content
            });

            if (result.records.length === 0) {
                throw new Error(`Translation for extension'${input.extension}' not found for snippet '${input.snippetName}'`);
            }

            const translation = result.records[0].get('t').properties;
            
            return {
                extension: translation.extension,
                content: translation.content,
                translatedAt: translation.translatedAt,
                snippetName: translation.snippetName
            };
        } finally {
            await session.close();
        }
    }

    async deleteSnippetTranslation(input: DeleteSnippetTranslationInput): Promise<void> {
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (s:Snippet {name: $snippetName})-[:HAS_TRANSLATION]->(t:Translation {extension: $extension})
                DETACH DELETE t
                RETURN count(t) as deleted
            `, {
                snippetName: input.snippetName,
                extension: input.extension
            });

            const deleted = result.records[0].get('deleted').toNumber();
            if (deleted === 0) {
                throw new Error(`Translation for extension'${input.extension}' not found for snippet '${input.snippetName}'`);
            }
        } finally {
            await session.close();
        }
    }

    async getSnippetWithTranslations(input: GetSnippetTranslationInput): Promise<SnippetWithTranslations> {
        const session = this.driver.session();
        try {
            // Get snippet with metadata
            const snippetResult = await session.run(`
                MATCH (s:Snippet {name: $snippetName})-[:HAS_METADATA]->(m:Metadata)
                WITH s, collect(DISTINCT m.category) AS categories, collect(DISTINCT m.name) AS metadataNames
                RETURN {
                    name: s.name,
                    content: s.content,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: metadataNames
                } AS snippet
            `, { snippetName: input.snippetName });

            if (snippetResult.records.length === 0) {
                throw new Error(`Snippet '${input.snippetName}' doesn't exist`);
            }

            const snippet = snippetResult.records[0].get('snippet');

            // Get translations (all or filtered by extension)
            const translationQuery = input.extension
                ? `MATCH (s:Snippet {name: $snippetName})-[:HAS_TRANSLATION]->(t:Translation {extension: $extension})
                RETURN t`
                : `MATCH (s:Snippet {name: $snippetName})-[:HAS_TRANSLATION]->(t:Translation)
                RETURN t`;

            const translationResult = await session.run(translationQuery, {
                snippetName: input.snippetName,
                extension: input.extension || null
            });

            const translations = translationResult.records.map(record => {
                const t = record.get('t').properties;
                return {
                    extension: t.extension,
                    content: t.content,
                    translatedAt: t.translatedAt,
                    snippetName: t.snippetName
                };
            });

            return {
                snippet: snippet,
                translations: translations
            };
        } finally {
            await session.close();
        }
    }

    async getSnippetTranslations(input: GetSnippetTranslationsInput): Promise<Translation[]> {
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (s:Snippet {name: $snippetName})-[:HAS_TRANSLATION]->(t:Translation)
                RETURN t
                ORDER BY t.extension
            `, { snippetName: input.snippetName });

            return result.records.map(record => {
                const t = record.get('t').properties;
                return {
                    extension: t.extension,
                    content: t.content,
                    translatedAt: t.translatedAt,
                    snippetName: t.snippetName
                };
            });
        } finally {
            await session.close();
        }
    }

    private async deleteAllSnippetTranslations(snippetName: string): Promise<void> {
        const session = this.driver.session();
        try {
            await session.run(`
                MATCH (s:Snippet {name: $snippetName})-[:HAS_TRANSLATION]->(t:Translation)
                DETACH DELETE t
            `, { snippetName });
        } finally {
            await session.close();
        }
    }

    /**
     * Clears database and storage
     */
    async clear(): Promise<void> {
        await this.clear_constraints();
        await this.clear_items();
        console.log("Database cleared: nodes, relationships, constraints and indexes removed."); 
    }

    async clear_constraints(): Promise<void> {
        const session: Session = this.driver.session();
        try {
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
        } finally {
            await session.close();
        }
    }

    async clear_items(): Promise<void> {
        const session: Session = this.driver.session();
        try {
            await session.run("MATCH (n) DETACH DELETE n");
        } finally {
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
     * @param category 
     */
    async create_field_constraint(
        session: Session, 
        label: string, 
        constraint_name: string, 
        field: string,
        category?: string
    ): Promise<void> {
        if (label === "Metadata" && category) {
            // Uniqueness constraint for name+category
            await session.run(`
                CREATE CONSTRAINT ${constraint_name} IF NOT EXISTS
                FOR (${label[0].toLowerCase()}:${label})
                REQUIRE (${label[0].toLowerCase()}.name, ${label[0].toLowerCase()}.category) IS UNIQUE
            `);
        } else {
            // constraint for snippet
            await session.run(`
                CREATE CONSTRAINT ${constraint_name} IF NOT EXISTS
                FOR (${label[0].toLowerCase()}:${label}) REQUIRE ${label[0].toLowerCase()}.${field} IS UNIQUE
            `);
        }
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
