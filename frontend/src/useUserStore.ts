import { ref } from "vue";

interface User {
  id: string;
  name: string;
}
const user = ref<User | null>(null);

export function useUserStore() {
  return {
    user,
    login: (_user: User) => (user.value = _user),
  };
}
