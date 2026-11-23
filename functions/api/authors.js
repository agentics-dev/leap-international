const adapt = require('../_content-adapter');
const handler = require('../../api/authors');

export const onRequest = adapt(handler);
