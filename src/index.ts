import http from "http";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { ApolloServer } from "@apollo/server";
import cors from "cors";
import express from "express";
import { expressMiddleware } from "@apollo/server/express4";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { Context } from "graphql-ws";

const TEN_SECONDS = 1000 * 10;

const typeDefs = `#graphql
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    id: String!
    title: String
    author: String
  }

  type User {
    id: String
    name: String
  }

  type Job {
    id: String!
    jobId: String
    title: String
    tasks: [Task]
  }

  type Task {
    id: String!
    title: String!
    activeUserId: String
    userId: String
  }

  type Query {
    books: [Book]
    jobs: [Job]
    users: [User]
    job(id: String): Job
  }

  type Mutation {
    joinJob(jobId: String, userId: String): String
    leaveJob(jobId: String, userId: String): String
    login(userId: String): String
    joinTask(taskId: String, jobId: String, userId: String): String
    clearTaskAssignments: Boolean
    heartbeat(userId: String!): Boolean
  }

  enum JobChangeType {
    JOB_JOIN
    JOB_LEAVE
    TASK_JOIN
    TASK_LEAVE
  }

  type JobUpdate {
    jobId: String
    changeType: JobChangeType
    payload: String # JSON
  }

  type Subscription {
    hello: String
    onJobJoined(jobId: String, userId: String): String
    activeTasks(jobId: String): [Task]
    jobUpdate(jobId: String): JobUpdate
    onEventLog(userId: String): String
  }
`;

const JOB_CHANGE_TYPES = {
  JOB_JOIN: "JOB_JOIN",
  JOB_LEAVE: "JOB_LEAVE",
  TASK_JOIN: "TASK_JOIN",
  TASK_LEAVE: "TASK_LEAVE",
};

const books = [
  {
    title: "The Awakening",
    author: "Kate Chopin",
  },
  {
    title: "City of Glass",
    author: "Paul Auster",
  },
];

const users = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "eve", name: "Eve" },
];

const jobs = [
  {
    id: "morning-chores",
    title: "Morning Chores",
    tasks: [
      {
        id: "task-1",
        title: "Unpack dishes",
        activeUserId: null,
      },
      {
        id: "task-2",
        title: "Get changed",
        activeUserId: null,
      },
      {
        id: "task-3",
        title: "Pack bag",
        activeUserId: null,
      },
    ],
  },
  {
    id: "evening-chores",
    title: "Evening Chores",
    tasks: [
      {
        id: "task-1",
        title: "Cook dinner",
        activeUserId: null,
      },
      {
        id: "task-2",
        title: "Take a shower",
        activeUserId: null,
      },
      {
        id: "task-3",
        title: "Go to sleep",
        activeUserId: null,
      },
    ],
  },
];

const pubsub = new RedisPubSub();

const activeUsers = new Map<string, number>();

import redis from "redis";

const subscriber = redis.createClient({
  url: "redis://localhost:6379", // Specify the Redis server URL
});

const globalChannel = "GLOBAL_CHANNEL";

async function pushGlobalEvent(event: string, message: string) {
  console.log(`Pushing global event ${event} => ${message}`);
  await pubsub.publish(globalChannel, {
    onEventLog: `[${event}]: ${message}`,
  });
}

global.setInterval(() => {
  for (const [userId, lastHeartbeatMs] of activeUsers) {
    const diff = Date.now() - lastHeartbeatMs;
    console.log(`Last heard from ${userId} ${diff / 1000} seconds ago`);
    if (diff > TEN_SECONDS) {
      // log out user and clear their assignment
      activeUsers.delete(userId);
      pushGlobalEvent(
        "FORCE_LOGOUT",
        `Force logout ${userId} due to inactivity`
      );
      clearAssignment();
    }
  }
}, 1000);

async function clearAssignment() {
  for (const job of jobs) {
    for (const task of job.tasks) {
      task.activeUserId = null;
    }

    await pubsub.publish(`activeTasks|${job.id}`, {
      activeTasks: job.tasks, // all,
    });
  }

  await pushGlobalEvent(
    "CLEAR_TASK_ASSIGNMENTS",
    `Admin cleared all task assignments`
  );
}

const resolvers = {
  Query: {
    books: () => books,
    jobs: () => jobs,
    users: () => users,
    job: (_context: Context, { id }: { id: string }) => {
      const job = jobs.find((x) => x.id === id);
      return job;
    },
  },

  Mutation: {
    heartbeat: async (_c: Context, payload: { userId: string }) => {
      activeUsers.set(payload.userId, Date.now());
      return true;
    },

    clearTaskAssignments: async () => {
      await clearAssignment();
      return true;
    },

    login: async (context: Context, payload: { userId: string }) => {
      activeUsers.set(payload.userId, Date.now());
      await pushGlobalEvent("LOGIN", `${payload.userId} logged in`);
      return "OK";
    },

    joinTask: async (
      context: Context,
      payload: { taskId: string; jobId: string; userId: string }
    ) => {
      await pushGlobalEvent(
        JOB_CHANGE_TYPES.TASK_JOIN,
        `User ${payload.userId} started work on task ${payload.taskId}`
      );

      const job = jobs.find((x) => x.id === payload.jobId);
      job.tasks = job.tasks.map((x) => {
        if (x.id !== payload.taskId) {
          return x;
        }
        return { ...x, activeUserId: payload.userId };
      });

      const activeTasks = job.tasks.filter((x) => Boolean(x.activeUserId));

      console.log(activeTasks);

      await pubsub.publish(`activeTasks|${payload.jobId}`, {
        // activeTasks: [], // activeTasks.filter((x) => x.jobId === payload.jobId),
        activeTasks,
      });

      return "OK";
    },

    joinJob: async (
      context: Context,
      payload: { userId: string; jobId: string }
    ) => {
      // await pubsub.publish(channel, { onJobJoined: JSON.stringify(payload) });
      await pubsub.publish(`channel|${payload.jobId}`, {
        jobUpdate: {
          jobId: payload.jobId,
          changeType: JOB_CHANGE_TYPES.JOB_JOIN,
          payload: JSON.stringify({
            userId: payload.userId,
          }),
        },
      });

      await pushGlobalEvent(
        JOB_CHANGE_TYPES.JOB_JOIN,
        `User ${payload.userId} joined job ${payload.jobId}`
      );

      return "OK";
    },

    leaveJob: async (
      context: Context,
      payload: { userId: string; jobId: string }
    ) => {
      await pushGlobalEvent(
        JOB_CHANGE_TYPES.JOB_LEAVE,
        `User ${payload.userId} left job ${payload.jobId}`
      );
      return "OK";
    },
  },

  Subscription: {
    activeTasks: {
      subscribe: (context: Context, variables: { jobId: string }) => {
        const channel = `activeTasks|${variables.jobId}`;
        return pubsub.asyncIterator(channel);
      },
    },

    onEventLog: {
      subscribe: (_context: Context) => {
        return pubsub.asyncIterator(globalChannel);
      },
    },

    jobUpdate: {
      subscribe: (
        context: Context,
        variables: { jobId: string; userId: string }
      ) => {
        const channel = `channel|${variables.jobId}`;
        console.log(`Joining ${channel}`);
        return pubsub.asyncIterator(channel);
      },
    },
    hello: {
      // subscribe: () => {
      //   console.log();
      //   pubsub.asyncIterator([HELLO_CHANNEL]);
      // },
      // Example using an async generator
      // subscribe: async function*() {
      //   console.log("Subscription!");
      //   for await (const word of ["Hello", "Bonjour", "Ciao"]) {
      //     console.log("yield => ", word);
      //     await new Promise((res) => setTimeout(res, 1000));
      //     yield { hello: word };
      //   }
      // },
    },
  },
};

const app = express();
const httpServer = http.createServer(app);

let schema = makeExecutableSchema({
  typeDefs: typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

const wsServer = new WebSocketServer({
  server: httpServer,
});

const serverCleanup = useServer({ schema }, wsServer);

await server.start();

app.use(
  "/graphql",
  cors(),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => {
      return { headers: req.headers };
    },
  })
);

httpServer.listen({ port: 4000 }, () => console.log(`🚀 Server ready`));
