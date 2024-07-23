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

const typeDefs = `#graphql
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    books: [Book]
  }

  type Subscription {
    hello: String
  }
`;

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

const HELLO_CHANNEL = "HELLO_CHANNEL";

const pubsub = new RedisPubSub();

// let i = 0;
// setInterval(() => {
//   i += 1;
//   pubsub.publish(HELLO_CHANNEL, { hello: `Count: ${i}` });
// }, 1000);

const resolvers = {
  Query: {
    books: () => books,
  },

  Subscription: {
    hello: {
      subscribe: () => pubsub.asyncIterator([HELLO_CHANNEL]),
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
const schema = makeExecutableSchema({ typeDefs, resolvers });

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

app.use("/graphql", cors(), express.json(), expressMiddleware(server));

httpServer.listen({ port: 4000 }, () => console.log(`🚀 Server ready`));
