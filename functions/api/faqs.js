const adapt = require('../_content-adapter');
const handler = require('../../api/faqs');

export const onRequest = adapt(handler);
