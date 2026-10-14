import { Container, getContainer } from "@cloudflare/containers";

export class CardsContainer extends Container {
  defaultPort = 38471;
  sleepAfter = "10m";
  enableInternet = true;
}

export default {
  async fetch(request: Request, env: { CARDS: DurableObjectNamespace<CardsContainer> }) {
    return getContainer(env.CARDS, "main").fetch(request);
  },
};
