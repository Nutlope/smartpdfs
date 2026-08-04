import Together from "together-ai";

export const togetheraiBaseClient = new Together({
  apiKey: process.env.TOGETHER_API_KEY ?? "",
});
