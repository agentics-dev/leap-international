const adapt = require('../_content-adapter');
const handler = require('../../api/news');

export const onRequest = adapt(handler);
