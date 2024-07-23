<script lang="ts" setup>
import { gql, useQuery, useSubscription } from "@urql/vue";

const result = useQuery({
  query: gql`
    {
      books {
        title
        author
      }
    }
  `,
});

const handleSubscription = (messages: any[] = [], response: any) => {
  return [response.hello, ...messages];
};

const sub = useSubscription(
  {
    query: `
    subscription Count {
      hello
    }`,
  },
  handleSubscription,
);
</script>

<template>
  <div>

    <h1>Query - Books</h1>
    <div v-if="result.fetching.value">Loading...</div>
    <div v-else-if="result.error.value">Oh no... {{ result.error.value }}</div>
    <div v-else>
      <ul v-if="result.data.value">
        <li v-for="book in result.data.value.books ?? []">{{ book.title }}</li>
      </ul>
    </div>

    <h1>Subscription - last 10 messages</h1>
    <ul>
      <li v-for="msg of sub.data.value?.slice(0, 10) ?? []">
        {{ msg }}
      </li>
    </ul>
  </div>
</template>
