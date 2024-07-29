<script lang="ts" setup>
import { useSubscription } from "@urql/vue";

function onLog(
  messages: string[] = [],
  { onEventLog }: { onEventLog: string }
) {
  return messages.concat(onEventLog);
  //...
}

const subscription = useSubscription(
  {
    query: `
    subscription EventLog {
      onEventLog
    }`,
  },
  onLog
);
</script>

<template>
  <div v-if="subscription.error.value">
    ERROR! {{ subscription.error.value }}
  </div>
  <ol v-else>
    <li v-for="msg of subscription.data.value ?? []">
      {{ msg }}
    </li>
  </ol>
</template>
