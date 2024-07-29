<script setup lang="ts">
import Hello from "./Hello.vue";
import { cacheExchange } from "@urql/exchange-graphcache";
import {
  Client,
  fetchExchange,
  provideClient,
  subscriptionExchange,
  useMutation,
} from "@urql/vue";
import { createClient as createWSClient } from "graphql-ws";
import EventLog from "./EventLog.vue";
import { useUserStore } from "./useUserStore";
import { onMounted } from "vue";
const wsClient = createWSClient({
  url: "ws://localhost:4000/graphql",
});

const client = new Client({
  url: "http://localhost:4000/graphql",
  fetchOptions: {
    headers: {
      platform: "customer",
    },
  },
  exchanges: [
    cacheExchange({}),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query || "" };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});

const userStore = useUserStore();

provideClient(client);

const clearTaskAssignmentsMut = useMutation(`
  mutation ClearTaskAssignments {
    clearTaskAssignments
  }
`);

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

async function clearTaskAssignments() {
  await clearTaskAssignmentsMut.executeMutation();
}
</script>

<template>
  <div class="m-4">
    <RouterLink class="underline" to="/">Home</RouterLink>
    <div class="grid grid-cols-[2fr_1fr]">
      <div>
        <Hello />
        <RouterView />
      </div>
      <div>
        <h1>Event Log</h1>
        <EventLog />
        <hr class="my-4" />

        <h1>Admin Panel</h1>
        <button
          class="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          @click="clearTaskAssignments"
        >
          Clear task assignments
        </button>
      </div>
    </div>
  </div>
</template>
