const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION);
const container = cosmosClient.database('MediaDB').container('MediaItems');

app.http('UpdateMedia', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'UpdateMedia/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: ''
            };
        }
        try {
            const id = request.params.id;
            const body = await request.json();
            const { resources } = await container.items
                .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
                .fetchAll();
            if (resources.length === 0) {
                return {
                    status: 404,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Media not found' })
                };
            }
            const existing = resources[0];
            const updated = {
                ...existing,
                title: body.title || existing.title,
                category: body.category || existing.category,
                tags: body.tags || existing.tags,
                updatedDate: new Date().toISOString()
            };
            await container.items.upsert(updated);
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(updated)
            };
        } catch (error) {
            context.log('Error:', error);
            return {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
});