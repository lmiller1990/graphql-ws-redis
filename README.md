# GraphQL Subscriptions / Redis Example

Demo showing GraphQL subscriptions with Apollo Server linking up to another service (in this case, python) via redis.

# Architecture

The design is based off the information found in the [Apollo Docs](https://www.apollographql.com/docs/apollo-server/data/subscriptions/).

Subscriptions in GraphQL are implemented via an AsyncIterator. A trivial example:

```ts
const resolvers = {
  Subscription: {
    hello: {
      // Example using an async generator
      subscribe: async function*() {
        for await (const word of ["Hello", "Bonjour", "Ciao"]) {
          console.log("yield => ", word);

          // delay for demo

          await new Promise((res) => setTimeout(res, 1000));
          yield { hello: word };
        }
      },
    },
  },
};
```

In the actual demo, this is supplied via the [`graphql-redis-subscriptions`](https://github.com/davidyaha/graphql-redis-subscriptions) library, which uses redis.

# Setup

## Redis

Install and start redis. Assuming default port 6379.

## Node.js

```sh
# install
npm install

# compile and start
npm run start
```

# Demo

Visit `http://localhost:4000/graphql` to see GraphQL.

## Frontend Integration

There is a Vue / Urql example. Ensure everything is running and: 

```sh
cd frontend
npm install
npm run dev
```

http://localhost:5173 has a Vue app with a query and subscription running.

# Detecting Offline / Inactivity

We do this via a "heartbeat". After N seconds of inactivity, boot them out and do whatever cleanup is needed to release resources the user might have locked (task, document, etc).

```ts
// for prod use redis for state
const activeUsers = new Map<string, number>();

global.setInterval(() => {
  for (const [userId, lastHeartbeatMs] of activeUsers) {
    const diff = Date.now() - lastHeartbeatMs;
    console.log(`Last heard from ${userId} ${diff / 1000} seconds ago`);
    if (diff > TEN_SECONDS) {
      // log out user and clear their assignment
      activeUsers.delete(userId);

      // subscription broadcast, mainly for debugging
      pushGlobalEvent(
        "FORCE_LOGOUT",
        `Force logout ${userId} due to inactivity`
      );

      // this clears all assigned tasks and broadcasts a notification via GraphQL
      clearAssignment();
    }
  }
}, 1000);
```

On the frontend we just make a request every N seconds:

```ts
const heartbeatMut = useMutation(`
  mutation Heartbeat($userId: String!) {
    heartbeat(userId: $userId)
  }
`);

window.setInterval(() => {
  if (userStore.user.value) {
    heartbeatMut.executeMutation({ userId: userStore.user.value.id });
  }
}, 2000);
```

# Merging Query data and Subscriptions

Unfortuately, on the initial subscription request, no data is received. Recommended pattern is query for initial data, and update with incoming subscription data. So, make sure you share the types - both query and subscription should use the same data structure, eg below both `Query` and `Subscription` use `Task`.

```graphql
  type Job {
    id: String!
    tasks: [Task]
  }

type Task {
  id: String!
  title: String!
}

type Query {
  tasks: [Task]
}

type Subscription {
  activeTasks(jobId: String): [Task]
}
```