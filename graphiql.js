import { createGraphiQLFetcher } from "@graphiql/toolkit";
import { GraphiQL } from "graphiql";
import React from "react";
import { createRoot } from "react-dom/client";

const fetcher = createGraphiQLFetcher({
  url: "http://localhost:4000/graphql",
  subscriptionUrl: "ws://localhost:4000/graphql",
});

const root = createRoot(document.getElementById("root"));
root.render(<GraphiQL fetcher={fetcher} />);
