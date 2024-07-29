<script lang="ts" setup>
import { useMutation, useQuery } from "@urql/vue";
import { useRoute } from "vue-router";
import { useUserStore } from "./useUserStore";
import { computed } from "vue";

const route = useRoute();

interface LockedCell {
  taskId: string;
  userId: string;
}

const props = defineProps<{
  lockedCells: LockedCell[];
}>();
</script>

<template></template>
