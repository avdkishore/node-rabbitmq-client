const config = {
  rabbitMQ: {
    host: process.env.PUBSUB_RABBITMQ_SERVICE_HOST || 'localhost',
    port: process.env.PUBSUB_RABBITMQ_SERVICE_PORT_AMQP || 5672,
    username: process.env.RABBITMQ_USERNAME || 'user',
    password: process.env.RABBITMQ_PASSWORD || 'user',
    prefetch: process.env.PREFETCH_JOBS || 2,
    protocol: 'amqp',
    heartbeatInterval: 5,
    reconnectTime: 10,
    options: {},
    queue: {
      myQueue: {
        name: process.env.MY_QUEUE || 'my_queue_1'
      },
      anotherQueue: {
        name: process.env.MY_QUEUE_2 || 'my_queue_2'
      }
    }
  }
};

module.exports = config;