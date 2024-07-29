import { createApp, h } from "vue";
import "./style.css";
import App from "./App.vue";
import { createRouter, createWebHistory } from "vue-router";
import JobView from "./JobView.vue";

const router = createRouter({
  routes: [
    {
      path: "/",
      component: null,
    },
    {
      path: "/job/:id",
      component: JobView,
    },
  ],
  history: createWebHistory(),
});

const app = createApp(App);
app.use(router);
app.mount("#app");
