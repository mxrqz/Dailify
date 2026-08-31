// Handlers de Web Push do Dailify. NÃO é o service worker registrado: ele é importado pelo
// `sw.js` que o Workbox gera (`workbox.importScripts` em vite.config.ts), porque dois service
// workers no mesmo escopo significa um sobrescrevendo o outro — e era isso que aconteceria com
// dois arquivos chamados `sw.js`.
//
// Sem `skipWaiting`/`clients.claim` aqui: quem cuida do ciclo de vida agora é o Workbox.

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
