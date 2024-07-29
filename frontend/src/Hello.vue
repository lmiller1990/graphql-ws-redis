<script lang="ts" setup>
import { gql, useMutation, useQuery } from "@urql/vue";
import { useUserStore } from "./useUserStore";

const result = useQuery({
  query: gql`
    {
      users {
        id
        name
      }
      jobs {
        id
        title
      }
    }
  `,
});

const loginMut = useMutation(`
  mutation Login ($userId: String) {
    login(userId: $userId)
  }
`);

const userStore = useUserStore();

async function login(user: any) {
  userStore.login(user);
  await loginMut.executeMutation(
    { userId: user.id },
    { requestPolicy: "network-only" }
  );
}
</script>

<template>
  <div>
    <h1>Users</h1>
    <ul>
      <li v-for="user in result.data.value?.users ?? []">
        <button
          class="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          @click="() => login(user)"
        >
          Login as {{ user.name }}
        </button>
      </li>
    </ul>

    <div v-if="userStore.user.value">
      Logged in as {{ userStore.user.value.name }}
    </div>

    <h1>Jobs</h1>

    <ul class="list-disc list-inside">
      <li v-for="job in result.data.value?.jobs ?? []">
        <RouterLink class="underline" :to="`/job/${job.id}`">{{
          job.title
        }}</RouterLink>
      </li>
    </ul>
  </div>
</template>
