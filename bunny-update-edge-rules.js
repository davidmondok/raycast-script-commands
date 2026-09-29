#!/usr/bin/env node

import createEdgeRules from './bunny.js';
import getBunnyApiKey from './bunny-key.js';

const apiKey = getBunnyApiKey();
const pullzoneId = 3366834;

await createEdgeRules('www.bio-austria.at', true, apiKey, pullzoneId);
await createEdgeRules('tutorsplus.com', true, apiKey, pullzoneId);
await createEdgeRules('dualseelen-zeit.de', false, apiKey, pullzoneId);
await createEdgeRules('www.brodner.at', false, apiKey, pullzoneId);
await createEdgeRules('www.drschanda.at', false, apiKey, pullzoneId);
await createEdgeRules('www.fisecker-harkopf.at', false, apiKey, pullzoneId);
await createEdgeRules('www.fliesenwelt-baden.at', false, apiKey, pullzoneId);
await createEdgeRules('www.gooddrivecrew.com', false, apiKey, pullzoneId);
await createEdgeRules('www.hundereise.at', false, apiKey, pullzoneId);
await createEdgeRules('www.internationalschoolparent.com', false, apiKey, pullzoneId);
await createEdgeRules('www.kanzleireiter.at', false, apiKey, pullzoneId);
await createEdgeRules('www.kinesiologie-mondok.at', false, apiKey, pullzoneId);
await createEdgeRules('www.klarart.at', false, apiKey, pullzoneId);
await createEdgeRules('www.ordinationschaefer.at', false, apiKey, pullzoneId);
await createEdgeRules('www.pkperformancehorses.fr', false, apiKey, pullzoneId);
await createEdgeRules('www.radler.co.at', false, apiKey, pullzoneId);
await createEdgeRules('www.renox.at', false, apiKey, pullzoneId);
await createEdgeRules('www.schatzis.at', false, apiKey, pullzoneId);
await createEdgeRules('www.unique-relations.at', false, apiKey, pullzoneId);
await createEdgeRules('www.webjuwel.at', false, apiKey, pullzoneId);
await createEdgeRules('www.woda.at', false, apiKey, pullzoneId);
await createEdgeRules('www.zeronimowine.com', false, apiKey, pullzoneId);
