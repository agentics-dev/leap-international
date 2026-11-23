const adapt = require('../_content-adapter');
const handler = require('../../api/case-studies');

export const onRequest = adapt(handler);
