import Pusher from 'pusher-js';

const pusherClient = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
  cluster: import.meta.env.VITE_PUSHER_CLUSTER,
});

export default pusherClient;