// Service worker do Dailify — existe só pelo Web Push (não faz cache nem offline).
// Fica em public/ de propósito: precisa ser servido da raiz do site para controlar todo o escopo.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function timeLabel(at) {
  if (typeof at !== "number") return "";
  return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // push sem payload utilizável ainda vale uma notificação: o navegador exige uma (userVisibleOnly)
  }

  const time = timeLabel(data.at);
  event.waitUntil(
    self.registration.showNotification(data.title || "Dailify", {
      body: time ? `Sua tarefa é às ${time}` : "Você tem uma tarefa agora",
      icon: "/dailify_logo_2.png",
      badge: "/dailify_logo_2.png",
      // tag = id da tarefa: reenvio do mesmo alerta substitui a notificação em vez de empilhar
      tag: data.taskId || "dailify-alert",
      data: { taskId: data.taskId },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reaproveita uma aba já aberta; abrir outra a cada notificação enche o navegador do usuário.
      const open = windows.find((w) => w.url.includes("/dashboard"));
      if (open) return open.focus();
      return self.clients.openWindow("/dashboard");
    }),
  );
});
