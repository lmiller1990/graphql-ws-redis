<script lang="ts" setup>
import _ from "lodash";
import { computed, onBeforeUnmount, watch } from "vue";
import { useUserStore } from "./useUserStore";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQuery, useSubscription } from "@urql/vue";

const { user } = useUserStore();

const router = useRouter();
const route = useRoute();

if (!user.value) {
  router.push("/");
}

const jobQuery = useQuery({
  query: `#graphql
    query GetJob($id: String) {
      job (id: $id) {
        id,
        title
        tasks {
          id
          __typename
          title
          activeUserId
        }
      }
    }
  `,
  variables: {
    id: route.params.id,
  },
});

const subscription = useSubscription<any>({
  query: `#graphql
    subscription ActiveTasks($jobId: String) {
      activeTasks(jobId: $jobId) {
        id
        __typename
        title
        activeUserId
      }
    }`,
  variables: {
    jobId: route.params.id,
  },
});

const tasks = computed(() => {
  // seems we have to merge the initial data from query and the
  // real time data from subscriptions?
  const all = (jobQuery.data.value?.job.tasks ?? []).concat(
    subscription.data.value?.activeTasks ?? []
  );

  return _.uniqWith(all, _.isEqual);
});

setTimeout(() => {
  subscription.executeSubscription();
}, 1000);

const joinMut = useMutation(
  `
  mutation Join ($jobId: String, $userId: String) {
    joinJob(jobId: $jobId, userId: $userId)
  }
`
);

const leaveMut = useMutation(
  `
  mutation Leave ($jobId: String, $userId: String) {
    leaveJob(jobId: $jobId, userId: $userId)
  }
`
);

let currentJobId = route.params.id;

onBeforeUnmount(async () => {
  await leaveMut.executeMutation(
    { jobId: currentJobId, userId: user.value!.id },
    {
      requestPolicy: "network-only",
    }
  );
});

watch(
  () => route.params.id,
  (newid) => {
    joinMut
      .executeMutation(
        { jobId: newid, userId: user.value!.id },
        {
          requestPolicy: "network-only",
        }
      )
      .then(() => {
        currentJobId = route.params.id;
      });
  },
  { immediate: true }
);

const joinTaskMut = useMutation(
  `#graphql
    mutation JoinTask($taskId: String, $jobId: String, $userId: String) {
      joinTask (taskId: $taskId, jobId: $jobId, userId: $userId)
    }
  `
);

async function joinTask(task: any) {
  const active = tasks.value.find((x) => x.id === task.id)?.activeUserId;
  if (active) {
    alert(`Cannot work on that task, it is already assigned to someone.`);
    return;
  }

  await joinTaskMut.executeMutation(
    {
      taskId: task.id,
      jobId: route.params.id!,
      userId: user.value?.id,
    },
    {
      requestPolicy: "network-only",
    }
  );
  //
}
</script>

<template>
  <div>Hello, {{ user?.name }}.</div>

  <div v-if="jobQuery.data.value">
    <ol class="list-disc list-inside">
      <li v-for="task of jobQuery.data.value?.job?.tasks ?? []">
        {{ task.title }}
      </li>
    </ol>

    <div class="px-4 sm:px-6 lg:px-8">
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div
            class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
          >
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Availability
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                    <!-- placeholder -->
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="task in tasks" :key="task.id">
                  <td
                    class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0"
                  >
                    {{ task.id }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ task.title }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div v-if="task.activeUserId">
                      Claimed by {{ task.activeUserId }}
                    </div>
                    <div v-else>
                      <!--  -->
                    </div>
                  </td>
                  <td
                    class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0"
                  >
                    <button
                      href="#"
                      class="text-indigo-600 hover:text-indigo-900"
                      @click="() => joinTask(task)"
                    >
                      Join task
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
