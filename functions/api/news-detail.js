const adapt = require('../_content-adapter');
const handler = require('../../api/news-detail');

export const onRequest = adapt(handler);
