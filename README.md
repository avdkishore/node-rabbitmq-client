# Connection management for rabbitmq client

Node js Rabbit MQ client which has connection management backed into it.
This project is written on top of [amqp-connection-manager](https://github.com/benbria/node-amqp-connection-manager).

## Features

* Automatically reconnect when your amqplib broker dies in a fire.
* Round-robin connections between multiple brokers in a cluster.
* If messages are sent while the broker is unavailable, queues messages in memory until we reconnect.
* Very un-opinionated library - a thin wrapper around amqplib.

## Usage

Install => yarn add git+ssh://git@github.com/log-os/node-rabbitmq-client

```javascript
const RabbitMQClient = require('node-rabbitmq-client');

const { publish, consume, purgeQueue, ackAll } = RabbitMQClient;

/* to publish a message */
publish({ queue: { name: 'some name' } }, data);
`data` is JS object

/* to consume from a queue */
consume({ queue: { name: 'some name' } }, promiseHandler);

/* to purge a queue */
purge({ queue: { name: 'some name' } });

/* to ack all messages */
ackAll();
```

## Please read this for implementing consume

* `promiseHandler` for consume should always return a resolved Promise even if some operations on the received message fails.
* When returning a resolved Promise, parameters need not be passed to it.If passed, these are simply ignored.
* Best practice is to implement a catch handler for the `promiseHandler` and push to some other queue and return a resolved Promise from there.
* If parsing the JSON message fails while consuming, this will try to push this error to another queue `parsingErrors`. So, if this failure is to be handled and noted, provide `parsingErrors` queue in the same config. (This is optional. Whether or not queue is provided, the error will be logged);
* `promiseHandler` gets the message and the options that were passed to consume intially

```javascript
/**
 * options is the object which is passed to consume at the time of initialization
 * 
 * options = {
 *    queue: {
 *    name: 'some-queue-name'
 *   }
 * }
 */
promiseFunction(message, options)
  .then(data => {
    /* once processing the message is successful, return resolved promise */
    /* if status queue is provided and success should be recorded */
    if (statusQueue && recordSuccess) {
      publish(statusQueue, {
        status: 'success',
        queueName,
        message: data
      });
    }

    /* this is needed to ack to the channel regarding this message */
    return Promise.resolve();
  })
  .catch(error => {
    if (statusQueue && recordError) {
      /* if status queue is provided and failure should be recorded */
      publish(statusQueue, {
        status: 'error',
        queueName,
        error,
        message
      }).then(() => channel.ack(msg));
    }
    logger.log('error', {
      note: `Error while processing the message from ${queueName}`,
      error: error
    });

    /* return resolved Promise from here */
    return Promise.resolve();
  });
```


## Configuration

By default, this looks at `/config/env/${NODE_ENV}` file for rabbitMQ configuration

```javascript
config = {
  rabbitMQ: {
    host: process.env.PUBSUB_RABBITMQ_SERVICE_HOST,
    port: process.env.PUBSUB_RABBITMQ_SERVICE_PORT_AMQP || 5672,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
    prefetch: process.env.PREFETCH_JOBS || 2,
    vhost: process.env.VHOST || '/',
    heartbeatInterval: process.env.HEARTBEAT || 5,
    reconnectTime: process.env.RECONNECT_TIME || 10,
    protocol: process.env.RABBITMQ_PROTOCOL || 'amqp',
    defaultQueueFeatures: { durable: true }
  }
}
```
