const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const {
    generateBlobSASQueryParameters,
    BlobSASPermissions,
    StorageSharedKeyCredential
} = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

// If you're NOT on Node 18+, uncomment this:
// const fetch = require('node-fetch');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION);
const container = cosmosClient.database('MediaDB').container('MediaItems');

app.http('CreateMedia', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',

    handler: async (request, context) => {

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: ''
            };
        }

        try {
            const body = await request.json();
            const { title, category, tags, uploadedBy, fileName, fileType } = body;

            if (!fileName) {
                return {
                    status: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'fileName is required' })
                };
            }

            const mediaId = uuidv4();
            const blobName = `${mediaId}-${encodeURIComponent(fileName)}`;

            // Validate env vars
            if (!process.env.COSMOS_CONNECTION) {
                throw new Error('COSMOS_CONNECTION is missing');
            }

            if (!process.env.STORAGE_CONNECTION) {
                throw new Error('STORAGE_CONNECTION is missing');
            }

            if (!process.env.LOGIC_APP_URL) {
                throw new Error('LOGIC_APP_URL is missing');
            }

            const accountName = 'cloudstreamb00909483';

            const accountKey = process.env.STORAGE_CONNECTION
                .split('AccountKey=')[1]
                .split(';')[0];

            const sharedKeyCredential = new StorageSharedKeyCredential(
                accountName,
                accountKey
            );

            const sasToken = generateBlobSASQueryParameters({
                containerName: 'media-files',
                blobName,
                permissions: BlobSASPermissions.parse('racwd'),
                expiresOn: new Date(Date.now() + 3600 * 1000),
            }, sharedKeyCredential).toString();

            const sasUrl = `https://${accountName}.blob.core.windows.net/media-files/${blobName}?${sasToken}`;

            const mediaItem = {
                id: mediaId,
                title,
                category,
                tags,
                uploadedBy,
                fileName,
                fileType,
                blobName,
                blobUrl: `https://${accountName}.blob.core.windows.net/media-files/${blobName}`,
                uploadDate: new Date().toISOString(),
                status: 'active'
            };

            await container.items.create(mediaItem);

            // Trigger Logic App workflow
            try {
                await fetch(process.env.LOGIC_APP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mediaId: mediaItem.id,
                        title: mediaItem.title,
                        category: mediaItem.category,
                        uploadedBy: mediaItem.uploadedBy,
                        blobUrl: mediaItem.blobUrl,
                        uploadDate: mediaItem.uploadDate
                    })
                });
            } catch (logicError) {
                context.log('Logic App trigger error:', logicError);
            }

            return {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ mediaId, sasUrl, mediaItem })
            };

        } catch (error) {
            context.log('Error:', error);

            return {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
});