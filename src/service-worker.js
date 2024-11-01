self.addEventListener("install", () => {
    // self.skipWaiting();
});
self.addEventListener('fetch', function (event) {
    console.log('Fetch event for ', event.request.url);
});
self.addEventListener("push", async (event) => {
    const data = event.data ? event.data.json() : {};
    console.log('Push event', data);
    event.waitUntil(self.registration.showNotification(data.title, {
        body: data.body.description,
        icon: accountIconUrl
    }));
});