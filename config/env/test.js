const config = {
  rabbitMQ: {
    host: process.env.PUBSUB_RABBITMQ_SERVICE_HOST || 'localhost',
    port: process.env.PUBSUB_RABBITMQ_SERVICE_PORT_AMQP || 5672,
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    prefetch: process.env.PREFETCH_JOBS || 2,
    queue: {
      profile: process.env.PROFILE_QUEUE || 'dev_profile_queue',
      affiliate: process.env.AFFILIATE_QUEUE || 'dev_affiliate_queue'
    }
  }
};

module.exports = config;