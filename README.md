# Connection management for rabbitmq client

Node js Rabbit MQ client which has connection management backed into it.
This project is written on top of [amqp-connection-manager](https://github.com/benbria/node-amqp-connection-manager).

## NOTE

Version 3 is a major and breaking change from Version 2. Please use appropriate version for your use.

## Features

* Automatically reconnect when your amqplib broker dies in a fire.
* Round-robin connections between multiple brokers in a cluster.
* If messages are sent while the broker is unavailable, queues messages in memory until we reconnect.
* Very un-opinionated library - a thin wrapper around amqplib.

## Configuration

```javascript
{
    host: process.env.PUBSUB_RABBITMQ_SERVICE_HOST,
    port: process.env.PUBSUB_RABBITMQ_SERVICE_PORT_AMQP || 5672,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
    prefetch: process.env.PREFETCH_JOBS || 2,
    vhost: process.env.VHOST || '/',
    heartbeatInterval: process.env.HEARTBEAT || 5,
    reconnectTime: process.env.RECONNECT_TIME || 10,
    protocol: process.env.RABBITMQ_PROTOCOL || 'amqp',
    defaultQueueFeatures: { durable: true },
    options: {
      // options.findServers(callback) is a function which returns one or more servers to connect to. This should return either a single URL or an array of URLs. This is handy when you're using a service discovery mechanism such as Consul or etcd. Instead of taking a callback, this can also return a Promise. Note that if this is supplied, then urls is ignored.
      findServers,
      // options.connectionOptions is passed as options to the amqplib connect method.
      connectionOptions
    }
}
```

## Usage

Using yarn: `yarn add node-rabbitmq-client@3.0.0` </br> OR
Using npm: `npm install node-rabbitmq-client@3.0.0`

```javascript
import RabbitMQClient from 'node-rabitmq-client';
// (OR)
const RabbitMQClient = require('node-rabbitmq-client');

// instantiate a client object
const client = new RabbitMQClient(config);

/* to publish a message */
// `data` is JS object
client.publish({ queue: { name: 'some name' } }, data);

/* to consume from a queue */
client.consume({ queue: { name: 'some name' } }, promiseHandler);

/* to purge a queue */
client.purge({ queue: { name: 'some name' } });

/* to ack all messages */
client.ackAll();
```

## Please read this for implementing consume

* `promiseHandler` for consume should always return a resolved Promise even if some operations on the received message fails.
* When returning a resolved Promise, parameters need not be passed to it.If passed, these are simply ignored.
* Best practice is to implement a catch handler for the `promiseHandler` and push to some other queue and return a resolved Promise from there.
* If parsing the JSON message fails while consuming, a rejected promise is thrown and needs to be handled appropriately (This is optional. Whether or not queue is provided, the error will be logged);
* `promiseHandler` gets the message and the options that were passed to consume intially

```javascript
/**
 *
  options is the object which is passed to consume at the time of initialization
  {
    queue: {
      name: 'some-queue-name',
      messagePriority: message priority (1-10), // set if the queue is a priority queue. It is optional
      options: {
        arguments: {
          'x-max-priority': queue priority (1- 10) // set to make the queue a priority queue. It is optional
        }
      }
    }
  }
 */
promiseFunction(message, options)
  .then(data => {
    /* once processing the message is successful, return resolved promise */
    /* if status queue is provided and success should be recorded */
    if (statusQueue && recordSuccess) {
      client.publish(statusQueue, {
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
      client.publish(statusQueue, {
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
