export class CardPriceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CardPriceError";
    this.status = status;
  }
}
