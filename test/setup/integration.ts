import {beforeEach, afterEach} from 'vitest';
import {createTopic, createSubscription, deleteSubscription, deleteTopic, cleanupTestSubscriptions} from '../utils/pubsub.js';

// Use the base environment variable names, but we'll ensure cleanup between tests
const topicName = process.env.PUBSUB_TOPIC_PAGE_HITS_RAW || 'test-traffic-analytics-page-hits-raw';
const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW || 'test-traffic-analytics-page-hits-raw-sub';

// eslint-disable-next-line ghost/mocha/no-top-level-hooks
beforeEach(async () => {
    // Clean up any orphaned test resources first
    await cleanupTestSubscriptions(/^test-.*-\d+-[a-z0-9]+$/);
    
    // Clean up the main test resources if they exist
    await deleteSubscription(subscriptionName);
    await deleteTopic(topicName);
    
    // Create fresh resources for this test
    await createTopic(topicName);
    await createSubscription(topicName, subscriptionName);
});

// eslint-disable-next-line ghost/mocha/no-top-level-hooks  
afterEach(async () => {
    await deleteSubscription(subscriptionName);
    await deleteTopic(topicName);
});