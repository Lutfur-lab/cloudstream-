const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION);
const container = cosmosClient.database('MediaDB').container('MediaItems');

app.http('GetMediaById', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'GetMediaById/{id}',
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
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(resources[0])
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